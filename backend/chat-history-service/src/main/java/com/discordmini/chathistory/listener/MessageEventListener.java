package com.discordmini.chathistory.listener;

import com.discordmini.chathistory.model.document.Message;
import com.discordmini.common.event.MessageEvent;
import com.discordmini.common.event.ReplyInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessageEventListener {

    private final MongoTemplate mongoTemplate;
    private final org.springframework.amqp.rabbit.core.RabbitTemplate rabbitTemplate;

    @RabbitListener(queues = "chat-history.message.queue")
    public void onMessageEvent(MessageEvent event) {
        if (event.getNonce() != null && !event.getNonce().trim().isEmpty()) {
            org.springframework.data.mongodb.core.query.Query query =
                new org.springframework.data.mongodb.core.query.Query(
                    org.springframework.data.mongodb.core.query.Criteria.where("nonce").is(event.getNonce())
                );
            Message existing = mongoTemplate.findOne(query, Message.class);
            if (existing != null) {
                log.info("Idempotency hit for nonce: {}. Re-broadcasting existing message: {}",
                    event.getNonce(), existing.getMessageId());

                java.util.Map<String, Object> sysEvent = new java.util.HashMap<>();
                sysEvent.put("eventType", "MESSAGE_NEW");
                sysEvent.put("id", existing.getId());
                sysEvent.put("messageId", existing.getMessageId());
                sysEvent.put("nonce", existing.getNonce());
                sysEvent.put("roomId", existing.getRoomId());
                sysEvent.put("channelId", existing.getChannelId());
                sysEvent.put("senderId", existing.getSenderId());
                sysEvent.put("senderName", existing.getSenderName());
                sysEvent.put("senderAvatar", existing.getSenderAvatar());
                sysEvent.put("content", existing.getContent());
                sysEvent.put("type", existing.getType() != null ? existing.getType() : "TEXT");
                sysEvent.put("fileKey", existing.getFileKey());
                sysEvent.put("fileName", existing.getFileName());
                sysEvent.put("fileSize", existing.getFileSize());
                sysEvent.put("createdAt", existing.getCreatedAt().toString());

                rabbitTemplate.convertAndSend("chat.exchange", "message.system", sysEvent);
                return;
            }
        }

        Message.ReplyTo replyTo = null;
        ReplyInfo eventReply = event.getReplyTo();
        if (eventReply != null) {
            replyTo = Message.ReplyTo.builder()
                    .messageId(eventReply.getMessageId())
                    .content(eventReply.getContent())
                    .senderName(eventReply.getSenderName())
                    .build();
        }

        Message message = Message.builder()
                .id(event.getId())
                .messageId(event.getMessageId())
                .nonce(event.getNonce())
                .roomId(event.getRoomId())
                .channelId(event.getChannelId())
                .senderId(event.getSenderId())
                .senderName(event.getSenderName())
                .senderAvatar(event.getSenderAvatar())
                .type(event.getType())
                .content(event.getContent())
                .fileKey(event.getFileKey())
                .fileName(event.getFileName())
                .fileSize(event.getFileSize())
                .isForwarded(event.isForwarded())
                .replyTo(replyTo)
                .mentions(event.getMentions())
                .createdAt(event.getCreatedAt() != null ? event.getCreatedAt() : Instant.now())
                .build();

        try {
            // Use insert() instead of save() for Idempotent Consumer pattern
            // DuplicateKeyException on messageId unique index = duplicate event → skip
            mongoTemplate.insert(message);
            log.info("Saved message: {}", event.getMessageId());
        } catch (DuplicateKeyException e) {
            log.warn("Duplicate message ignored: {}", event.getMessageId());
        }
    }
}
