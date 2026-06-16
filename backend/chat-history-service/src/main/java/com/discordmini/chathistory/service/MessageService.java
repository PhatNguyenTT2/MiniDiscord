package com.discordmini.chathistory.service;

import com.discordmini.chathistory.client.MembershipClient;
import com.discordmini.chathistory.exception.ForbiddenException;
import com.discordmini.chathistory.exception.ResourceNotFoundException;
import com.discordmini.chathistory.exception.BadRequestException;
import com.discordmini.chathistory.model.document.Message;
import com.discordmini.chathistory.model.dto.MessageResponse;
import com.discordmini.chathistory.repository.MessageRepository;
import com.discordmini.chathistory.repository.ReadReceiptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.mongodb.core.query.TextCriteria;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ReadReceiptRepository readReceiptRepository;
    private final MembershipClient membershipClient;
    private final RabbitTemplate rabbitTemplate;
    private final MongoTemplate mongoTemplate;
    private static final int MAX_LIMIT = 100;

    public List<MessageResponse> getMessages(String userId, String roomId, String channelId, String before,
            String after, int limit) {
        membershipClient.verifyMembership(userId, roomId);

        int clampedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

        // Resolve cursors cleanly to support both MongoDB ObjectIds and UUID messageIds
        String resolvedAfter = resolveCursorId(after);
        String resolvedBefore = resolveCursorId(before);

        List<Message> messages;
        if (resolvedAfter != null) {
            // Forward cursor pagination: load chronological messages after the cursor
            PageRequest ascPageable = PageRequest.of(0, clampedLimit, Sort.by(Sort.Direction.ASC, "_id"));
            messages = messageRepository.findByRoomIdAndChannelIdFilteredUserAfterCursor(
                    roomId, channelId, userId, resolvedAfter, ascPageable);
            // Already ASC, just map and return
            return messages.stream().map(MessageResponse::from).collect(Collectors.toList());
        }

        PageRequest descPageable = PageRequest.of(0, clampedLimit, Sort.by(Sort.Direction.DESC, "_id"));
        if (resolvedBefore != null) {
            messages = messageRepository.findByRoomIdAndChannelIdFilteredUserBeforeCursor(
                    roomId, channelId, userId, resolvedBefore, descPageable);
        } else {
            messages = messageRepository.findByRoomIdAndChannelIdFilteredUser(
                    roomId, channelId, userId, descPageable);
        }

        // DESC query for cursor pagination, then reverse for chronological display
        // (oldest→newest)
        List<MessageResponse> responses = messages.stream()
                .map(MessageResponse::from)
                .collect(Collectors.toList());
        Collections.reverse(responses);
        return responses;
    }

    public List<MessageResponse> advancedSearch(
            String userId, String roomId, String channelId,
            String q, String from, String has, String mentions, int limit) {
        log.info(
                "[advancedSearch] userId: {}, roomId: {}, channelId: {}, q: {}, from: {}, has: {}, mentions: {}, limit: {}",
                userId, roomId, channelId, q, from, has, mentions, limit);
        membershipClient.verifyMembership(userId, roomId);

        int clampedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

        // Core filter conditions: roomId, channelId, isDeleted=false, and not deleted
        // for client user
        Criteria criteria = Criteria.where("roomId").is(roomId)
                .and("channelId").is(channelId)
                .and("isDeleted").is(false)
                .and("deletedForUsers").nin(userId);

        // Filter: 'from' represents senderName (username typed in search box)
        if (from != null && !from.trim().isEmpty()) {
            criteria.and("senderName").regex("^" + Pattern.quote(from.trim()) + "$", "i");
        }

        Query query = new Query(criteria)
                .with(Sort.by(Sort.Direction.DESC, "_id")) // descending order by Object ID (cursor)
                .limit(clampedLimit);

        // Filter: 'mentions' represents matches pattern @username in content string
        if (mentions != null && !mentions.trim().isEmpty()) {
            String mentionStr = mentions.trim();
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where("mentions").is(mentionStr),
                    Criteria.where("content").regex("<@" + Pattern.quote(mentionStr) + ">")));
        }

        // Filter: 'has' represents message content types (IMAGE, VIDEO, etc.)
        if (has != null && !has.trim().isEmpty()) {
            String typeStr = has.toLowerCase().trim();
            switch (typeStr) {
                case "image":
                case "hình ảnh":
                    query.addCriteria(new Criteria().orOperator(
                            Criteria.where("type").is("IMAGE"),
                            Criteria.where("fileName").regex("\\.(jpeg|jpg|gif|png|webp|svg)($|\\?)", "i")));
                    break;
                case "video":
                    query.addCriteria(new Criteria().orOperator(
                            Criteria.where("type").is("VIDEO"),
                            Criteria.where("fileName").regex("\\.(mp4|webm|mov)($|\\?)", "i")));
                    break;
                case "link":
                    query.addCriteria(Criteria.where("content").regex("https?://", "i"));
                    break;
                case "file":
                case "tệp":
                    query.addCriteria(new Criteria().andOperator(
                            Criteria.where("fileKey").exists(true).ne(null).ne(""),
                            Criteria.where("type").nin("IMAGE", "VIDEO", "AUDIO", "STICKER"),
                            new Criteria().orOperator(
                                    Criteria.where("fileName").exists(false),
                                    Criteria.where("fileName").is(null),
                                    Criteria.where("fileName").not().regex(
                                            "\\.(jpeg|jpg|gif|png|webp|svg|mp4|webm|mov|mp3|wav|ogg)($|\\?)", "i"))));
                    break;
                case "audio":
                case "âm thanh":
                    query.addCriteria(new Criteria().orOperator(
                            Criteria.where("type").is("AUDIO"),
                            Criteria.where("fileName").regex("\\.(mp3|wav|ogg)($|\\?)", "i")));
                    break;
                case "sticker":
                    query.addCriteria(new Criteria().orOperator(
                            Criteria.where("type").is("STICKER"),
                            Criteria.where("stickerIds.0").exists(true)));
                    break;
            }
        }

        // Filter: 'q' represents text criteria matching using indexed idx_content_text
        // index
        if (q != null && !q.trim().isEmpty()) {
            query.addCriteria(TextCriteria.forDefaultLanguage().matching(q.trim()));
        }

        return mongoTemplate.find(query, Message.class)
                .stream().map(MessageResponse::from).collect(Collectors.toList());
    }

    public void softDeleteMessage(String userId, String messageId, String deleteType) {
        Message message = messageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));

        if ("FOR_ME".equals(deleteType)) {
            // Atomic $addToSet — chỉ ẩn cho user này
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("messageId").is(messageId)),
                    new Update().addToSet("deletedForUsers", userId),
                    Message.class);
            // NO broadcast — chỉ UI local cần ẩn
            return;
        }

        if (!userId.equals(message.getSenderId())) {
            membershipClient.verifyMessageDeletePrivilege(userId, message.getRoomId());
        }

        message.setDeleted(true);
        message.setDeletedAt(Instant.now());
        messageRepository.save(message);

        // Broadcast deleted event
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "MESSAGE_DELETED");
        event.put("channelId", message.getChannelId());
        event.put("roomId", message.getRoomId());
        event.put("messageId", messageId);

        rabbitTemplate.convertAndSend("chat.exchange", "message.system", event);
    }

    public MessageResponse editMessage(String userId, String messageId, String newContent) {
        Message message = messageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));

        if (!userId.equals(message.getSenderId())) {
            throw new ForbiddenException("Only the sender can edit this message");
        }

        if (message.isDeleted()) {
            throw new ForbiddenException("Cannot edit a deleted message");
        }

        Instant now = Instant.now();
        message.setContent(newContent);
        message.setEdited(true);
        message.setUpdatedAt(now);
        Message saved = messageRepository.save(message);

        // Broadcast edited event
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "MESSAGE_EDITED");
        event.put("channelId", message.getChannelId());
        event.put("roomId", message.getRoomId());
        event.put("messageId", messageId);
        event.put("content", newContent);
        event.put("editedAt", now.toString());

        rabbitTemplate.convertAndSend("chat.exchange", "message.system", event);

        return MessageResponse.from(saved);
    }

    public MessageResponse toggleReaction(String userId, String messageId, String emoji) {
        Message msg = messageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));

        membershipClient.verifyMembership(userId, msg.getRoomId());

        boolean alreadyReacted = msg.getReactions() != null && msg.getReactions().stream()
                .anyMatch(r -> r.getEmoji().equals(emoji) && r.getUserIds() != null && r.getUserIds().contains(userId));

        Query query = Query.query(Criteria.where("messageId").is(messageId)
                .and("reactions.emoji").is(emoji));

        if (alreadyReacted) {
            // ATOMIC $pull userId from existing reaction
            Update update = new Update().pull("reactions.$.userIds", userId);
            mongoTemplate.updateFirst(query, update, Message.class);

            // Clean up empty reactions (no userIds left)
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("messageId").is(messageId)),
                    new Update().pull("reactions", Query.query(Criteria.where("userIds").size(0))),
                    Message.class);
        } else {
            // Check if emoji reaction exists
            boolean emojiExists = msg.getReactions() != null && msg.getReactions().stream()
                    .anyMatch(r -> r.getEmoji().equals(emoji));

            if (emojiExists) {
                // ATOMIC $addToSet userId to existing reaction
                Update update = new Update().addToSet("reactions.$.userIds", userId);
                mongoTemplate.updateFirst(query, update, Message.class);
            } else {
                // Push new reaction entry
                Message.Reaction newReaction = Message.Reaction.builder()
                        .emoji(emoji).userIds(List.of(userId)).build();
                mongoTemplate.updateFirst(
                        Query.query(Criteria.where("messageId").is(messageId)),
                        new Update().push("reactions", newReaction),
                        Message.class);
            }
        }

        // Re-fetch and broadcast
        Message updated = messageRepository.findByMessageId(messageId).orElseThrow();

        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "MESSAGE_REACTED");
        event.put("channelId", updated.getChannelId());
        event.put("roomId", updated.getRoomId());
        event.put("messageId", messageId);
        event.put("reactions", MessageResponse.from(updated).getReactions());
        rabbitTemplate.convertAndSend("chat.exchange", "message.system", event);

        return MessageResponse.from(updated);
    }

    public MessageResponse pinMessage(String userId, String messageId) {
        return pinMessage(userId, messageId, "User");
    }

    public MessageResponse pinMessage(String userId, String messageId, String senderName) {
        Message msg = messageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));

        membershipClient.verifyPinPrivilege(userId, msg.getRoomId());

        if (msg.isPinned()) {
            return MessageResponse.from(msg);
        }

        long pinCount = mongoTemplate.count(
                Query.query(Criteria.where("roomId").is(msg.getRoomId())
                        .and("channelId").is(msg.getChannelId())
                        .and("isPinned").is(true)
                        .and("isDeleted").is(false)),
                Message.class);

        if (pinCount >= 50) {
            throw new BadRequestException("Channel has reached the maximum of 50 pinned messages.");
        }

        mongoTemplate.updateFirst(
                Query.query(Criteria.where("messageId").is(messageId)),
                new Update().set("isPinned", true),
                Message.class);

        Message updated = messageRepository.findByMessageId(messageId).orElseThrow();

        // Save a system message to chat history
        Message systemMsg = Message.builder()
                .messageId(UUID.randomUUID().toString())
                .roomId(updated.getRoomId())
                .channelId(updated.getChannelId())
                .senderId(userId)
                .senderName(senderName)
                .type("SYSTEM")
                .content("pinned_message")
                .createdAt(Instant.now())
                .build();
        messageRepository.save(systemMsg);

        // Broadcast pin event
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "MESSAGE_PINNED");
        event.put("channelId", updated.getChannelId());
        event.put("roomId", updated.getRoomId());
        event.put("messageId", messageId);
        event.put("isPinned", true);
        rabbitTemplate.convertAndSend("chat.exchange", "message.system", event);

        // Broadcast system message event so it appears in chat real-time
        Map<String, Object> systemMsgEvent = new HashMap<>();
        systemMsgEvent.put("eventType", "SYSTEM_MESSAGE_NEW");
        systemMsgEvent.put("messageId", systemMsg.getMessageId());
        systemMsgEvent.put("roomId", systemMsg.getRoomId());
        systemMsgEvent.put("channelId", systemMsg.getChannelId());
        systemMsgEvent.put("senderId", systemMsg.getSenderId());
        systemMsgEvent.put("senderName", systemMsg.getSenderName());
        systemMsgEvent.put("type", "SYSTEM");
        systemMsgEvent.put("content", systemMsg.getContent());
        systemMsgEvent.put("createdAt", systemMsg.getCreatedAt().toString());
        rabbitTemplate.convertAndSend("chat.exchange", "message.system", systemMsgEvent);

        return MessageResponse.from(updated);
    }

    public MessageResponse unpinMessage(String userId, String messageId) {
        Message msg = messageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));

        membershipClient.verifyPinPrivilege(userId, msg.getRoomId());

        if (!msg.isPinned()) {
            return MessageResponse.from(msg);
        }

        mongoTemplate.updateFirst(
                Query.query(Criteria.where("messageId").is(messageId)),
                new Update().set("isPinned", false),
                Message.class);

        Message updated = messageRepository.findByMessageId(messageId).orElseThrow();

        // Broadcast unpin event
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", "MESSAGE_PINNED");
        event.put("channelId", updated.getChannelId());
        event.put("roomId", updated.getRoomId());
        event.put("messageId", messageId);
        event.put("isPinned", false);
        rabbitTemplate.convertAndSend("chat.exchange", "message.system", event);

        return MessageResponse.from(updated);
    }

    public List<MessageResponse> getPinnedMessages(String userId, String roomId, String channelId) {
        membershipClient.verifyMembership(userId, roomId);

        Query query = new Query(Criteria.where("roomId").is(roomId)
                .and("channelId").is(channelId)
                .and("isPinned").is(true)
                .and("isDeleted").is(false))
                .with(Sort.by(Sort.Direction.DESC, "_id"))
                .limit(50);

        return mongoTemplate.find(query, Message.class)
                .stream().map(MessageResponse::from)
                .collect(Collectors.toList());
    }

    public void clearAllHistory() {
        messageRepository.deleteAll();
        readReceiptRepository.deleteAll();
    }

    private String resolveCursorId(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }

        String clean = cursor.trim();
        if (clean.startsWith("msg-")) {
            clean = clean.substring(4);
        } else if (clean.startsWith("optimistic-")) {
            clean = clean.substring(11);
        }

        // Check if cursor matches a 24-character hexadecimal ObjectId
        if (isValidObjectId(clean)) {
            return clean;
        }

        // If not a valid ObjectId (e.g. UUID), lookup the message mapping to resolve
        // its DB ObjectId
        Optional<Message> msgOpt = messageRepository.findByMessageId(clean);
        if (msgOpt.isPresent()) {
            return msgOpt.get().getId();
        }

        log.warn("[resolveCursorId] Failed to resolve message cursor ID: {}", cursor);
        return null;
    }

    private boolean isValidObjectId(String s) {
        if (s == null || s.length() != 24) {
            return false;
        }
        for (int i = 0; i < 24; i++) {
            char c = s.charAt(i);
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) {
                return false;
            }
        }
        return true;
    }
}
