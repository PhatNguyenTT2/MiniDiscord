package com.discordmini.chathistory.service;

import com.discordmini.chathistory.client.MembershipClient;
import com.discordmini.chathistory.model.document.Message;
import com.discordmini.chathistory.model.document.ReadReceipt;
import com.discordmini.chathistory.model.dto.ReadReceiptResponse;
import com.discordmini.chathistory.repository.ReadReceiptRepository;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ReadReceiptService {

    private final ReadReceiptRepository readReceiptRepository;
    private final MembershipClient membershipClient;
    private final MongoTemplate mongoTemplate;

    private static final int UNREAD_CAP = 100;

    /**
     * Mark channel as read up to the given message ID.
     * Uses ObjectId comparison instead of string lexicographic order.
     */
    public void markAsRead(String userId, String roomId, String channelId, String lastReadMessageId) {
        membershipClient.verifyMembership(userId, roomId);

        ObjectId resolvedId = resolveToObjectId(lastReadMessageId);
        if (resolvedId == null) {
            return; // Cannot resolve — skip silently
        }

        readReceiptRepository.findByUserIdAndChannelId(userId, channelId)
                .ifPresentOrElse(
                        existing -> {
                            ObjectId existingId = resolveToObjectId(existing.getLastReadMessageId());
                            // Only update if new ID is strictly greater (newer message)
                            if (existingId == null || resolvedId.compareTo(existingId) > 0) {
                                existing.setLastReadMessageId(resolvedId.toHexString());
                                existing.setLastReadAt(LocalDateTime.now());
                                readReceiptRepository.save(existing);
                            }
                        },
                        () -> {
                            // First time reading this channel
                            ReadReceipt receipt = ReadReceipt.builder()
                                    .userId(userId)
                                    .roomId(roomId)
                                    .channelId(channelId)
                                    .lastReadMessageId(resolvedId.toHexString())
                                    .lastReadAt(LocalDateTime.now())
                                    .build();
                            readReceiptRepository.save(receipt);
                        });
    }

    /**
     * Mark channel as unread starting from a specific message.
     * Rolls back lastReadMessageId to the message BEFORE the target.
     */
    public ReadReceiptResponse markAsUnread(String userId, String roomId, String channelId, String targetMessageId) {
        membershipClient.verifyMembership(userId, roomId);

        ObjectId targetId = resolveToObjectId(targetMessageId);
        if (targetId == null) {
            throw new IllegalArgumentException("Cannot resolve message ID: " + targetMessageId);
        }

        // Find the message immediately BEFORE the target message in this channel
        Query beforeQuery = new Query();
        beforeQuery.addCriteria(Criteria.where("roomId").is(roomId));
        beforeQuery.addCriteria(Criteria.where("channelId").is(channelId));
        beforeQuery.addCriteria(Criteria.where("isDeleted").is(false));
        beforeQuery.addCriteria(Criteria.where("_id").lt(targetId));
        beforeQuery.with(Sort.by(Sort.Direction.DESC, "_id"));
        beforeQuery.limit(1);

        Message previousMessage = mongoTemplate.findOne(beforeQuery, Message.class);

        if (previousMessage == null) {
            // Target is the first message — delete the receipt entirely
            readReceiptRepository.findByUserIdAndChannelId(userId, channelId)
                    .ifPresent(readReceiptRepository::delete);
        } else {
            // Roll back watermark to the previous message
            readReceiptRepository.findByUserIdAndChannelId(userId, channelId)
                    .ifPresentOrElse(
                            existing -> {
                                existing.setLastReadMessageId(previousMessage.getId());
                                existing.setLastReadAt(LocalDateTime.now());
                                readReceiptRepository.save(existing);
                            },
                            () -> {
                                // No receipt exists — create one pointing to the previous message
                                ReadReceipt receipt = ReadReceipt.builder()
                                        .userId(userId)
                                        .roomId(roomId)
                                        .channelId(channelId)
                                        .lastReadMessageId(previousMessage.getId())
                                        .lastReadAt(LocalDateTime.now())
                                        .build();
                                readReceiptRepository.save(receipt);
                            });
        }

        // Return fresh unread count
        return getUnreadCount(userId, roomId, channelId);
    }

    public ReadReceiptResponse getUnreadCount(String userId, String roomId, String channelId) {
        membershipClient.verifyMembership(userId, roomId);

        String lastReadId = readReceiptRepository.findByUserIdAndChannelId(userId, channelId)
                .map(ReadReceipt::getLastReadMessageId)
                .orElse(null);

        Query query = new Query();
        query.addCriteria(Criteria.where("roomId").is(roomId));
        query.addCriteria(Criteria.where("channelId").is(channelId));
        query.addCriteria(Criteria.where("isDeleted").is(false));

        if (lastReadId != null) {
            ObjectId cursorId = resolveToObjectId(lastReadId);
            if (cursorId != null) {
                query.addCriteria(Criteria.where("_id").gt(cursorId));
            }
        }

        // Bounded count: cap at 100 to avoid full collection scan
        query.limit(UNREAD_CAP);
        long count = mongoTemplate.count(query, "messages");

        boolean hasMore = count >= UNREAD_CAP;
        String displayCount = hasMore ? "99+" : String.valueOf(count);

        return ReadReceiptResponse.builder()
                .count(Math.min(count, UNREAD_CAP - 1))
                .displayCount(displayCount)
                .hasMore(hasMore)
                .lastReadMessageId(lastReadId)
                .build();
    }

    /**
     * Resolve a message identifier (ObjectId hex or UUID messageId) to an ObjectId.
     * Returns null if resolution fails.
     */
    private ObjectId resolveToObjectId(String id) {
        if (id == null)
            return null;

        // Try direct ObjectId parse first
        try {
            return new ObjectId(id);
        } catch (IllegalArgumentException ignored) {
        }

        // Fallback: look up by UUID messageId field
        Query lookup = new Query(Criteria.where("messageId").is(id));
        lookup.fields().include("_id");
        Message doc = mongoTemplate.findOne(lookup, Message.class);
        if (doc != null) {
            try {
                return new ObjectId(doc.getId());
            } catch (IllegalArgumentException ignored) {
            }
        }

        return null;
    }
}
