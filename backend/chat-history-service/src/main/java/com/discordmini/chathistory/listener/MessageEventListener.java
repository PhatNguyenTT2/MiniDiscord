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

    @RabbitListener(queues = "chat-history.message.queue")
    public void onMessageEvent(MessageEvent event) {
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
                .messageId(event.getMessageId())
                .roomId(event.getRoomId())
                .channelId(event.getChannelId())
                .senderId(event.getSenderId())
                .senderName(event.getSenderName())
                .senderAvatar(event.getSenderAvatar())
                .type(event.getType())
                .content(event.getContent())
                .fileUrl(event.getFileUrl())
                .fileName(event.getFileName())
                .fileSize(event.getFileSize())
                .replyTo(replyTo)
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
