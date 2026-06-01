package com.discordmini.chathistory.service;

import com.discordmini.chathistory.client.MembershipClient;
import com.discordmini.chathistory.exception.ForbiddenException;
import com.discordmini.chathistory.exception.ResourceNotFoundException;
import com.discordmini.chathistory.model.document.Message;
import com.discordmini.chathistory.model.dto.MessageResponse;
import com.discordmini.chathistory.repository.MessageRepository;
import com.discordmini.chathistory.repository.ReadReceiptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.mongodb.core.query.TextCriteria;
import java.util.regex.Pattern;

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

        List<Message> messages;
        if (after != null && !after.isBlank()) {
            // Forward cursor pagination: load chronological messages after the cursor
            PageRequest ascPageable = PageRequest.of(0, clampedLimit, Sort.by(Sort.Direction.ASC, "_id"));
            messages = messageRepository.findByRoomIdAndChannelIdFilteredUserAfterCursor(
                    roomId, channelId, userId, after, ascPageable);
            // Already ASC, just map and return
            return messages.stream().map(MessageResponse::from).collect(Collectors.toList());
        }

        PageRequest descPageable = PageRequest.of(0, clampedLimit, Sort.by(Sort.Direction.DESC, "_id"));
        if (before != null && !before.isBlank()) {
            messages = messageRepository.findByRoomIdAndChannelIdFilteredUserBeforeCursor(
                    roomId, channelId, userId, before, descPageable);
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
        membershipClient.verifyMembership(userId, roomId);

        int clampedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

        // Core filter conditions: roomId, channelId, and isDeleted=false
        Criteria criteria = Criteria.where("roomId").is(roomId)
                .and("channelId").is(channelId)
                .and("isDeleted").is(false);

        // Filter: 'from' represents senderId (index-backed by idx_sender_time)
        if (from != null && !from.trim().isEmpty()) {
            criteria.and("senderId").is(from);
        }

        // Filter: 'has' represents message content types (IMAGE, VIDEO, etc.)
        if (has != null && !has.trim().isEmpty()) {
            String typeStr = has.toLowerCase().trim();
            switch (typeStr) {
                case "image":
                case "hình ảnh":
                    criteria.and("type").is("IMAGE");
                    break;
                case "video":
                    criteria.and("type").is("VIDEO");
                    break;
                case "link":
                    // Regex find links: backed partially by compound cursor index scanning
                    criteria.and("content").regex("https?://", "i");
                    break;
                case "file":
                case "tệp":
                    criteria.and("type").is("FILE");
                    break;
                case "audio":
                case "âm thanh":
                    criteria.and("type").is("AUDIO");
                    break;
                case "sticker":
                    criteria.and("type").is("STICKER");
                    break;
            }
        }

        // Filter: 'mentions' represents matches pattern @username in content string
        if (mentions != null && !mentions.trim().isEmpty()) {
            criteria.and("content").regex("@" + Pattern.quote(mentions.trim()), "i");
        }

        Query query = new Query(criteria)
                .with(Sort.by(Sort.Direction.DESC, "_id")) // descending order by Object ID (cursor)
                .limit(clampedLimit);

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
            throw new ForbiddenException("Only the sender can delete this message for everyone");
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

    public void clearAllHistory() {
        messageRepository.deleteAll();
        readReceiptRepository.deleteAll();
    }
}
