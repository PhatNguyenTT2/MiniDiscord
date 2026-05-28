package com.discordmini.messaging.service;

import com.discordmini.common.event.MessageEvent;
import com.discordmini.messaging.config.RabbitMQConfig;
import com.discordmini.messaging.model.dto.ChatMessage;
import com.discordmini.messaging.model.dto.TargetedMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageRouter {

    private final RabbitTemplate rabbitTemplate;
    private final ConnectionManager connectionManager;
    private final StringRedisTemplate redisTemplate;

    // 1. Publish MessageEvent for chat-history-service to save
    @Async("taskExecutor")
    public void publishToHistory(MessageEvent event) {
        log.debug("Publishing message {} to chat.exchange", event.getMessageId());
        rabbitTemplate.convertAndSend(RabbitMQConfig.CHAT_EXCHANGE, "message.sent", event);
    }

    // 2. Fan-out message to instances holding connected members
    @Async("taskExecutor")
    public void fanOutToMembers(ChatMessage message, String roomId) {
        Set<String> memberIds = getRoomMembers(roomId);
        if (memberIds == null || memberIds.isEmpty()) {
            return;
        }

        // Group members by the instance they are connected to
        Map<String, List<String>> instanceToUsers = new HashMap<>();

        for (String userId : memberIds) {
            String instanceId = connectionManager.getInstanceForUser(userId);
            if (instanceId != null) {
                instanceToUsers.computeIfAbsent(instanceId, k -> new ArrayList<>()).add(userId);
            }
        }

        log.debug("Fanning out message {} to {} instances", message.getMessageId(), instanceToUsers.size());

        // Publish targeted message to each instance via ws.exchange
        instanceToUsers.forEach((instanceId, users) -> {
            TargetedMessage targetedMessage = new TargetedMessage(users, message);
            rabbitTemplate.convertAndSend(RabbitMQConfig.WS_EXCHANGE, "server." + instanceId, targetedMessage);
        });
    }

    private Set<String> getRoomMembers(String roomId) {
        // Query Redis cache (populated by MembershipClient)
        // Note: For large rooms, we might want to paginate or use specialized data
        // structures
        return redisTemplate.opsForSet().members("room:members:" + roomId);
    }

    // 3. Fan-out system map events (edit, delete)
    @Async("taskExecutor")
    public void fanOutSystemEvent(Map<String, Object> event, String roomId) {
        Set<String> memberIds = getRoomMembers(roomId);
        if (memberIds == null || memberIds.isEmpty()) {
            return;
        }

        Map<String, List<String>> instanceToUsers = new HashMap<>();

        for (String userId : memberIds) {
            String instanceId = connectionManager.getInstanceForUser(userId);
            if (instanceId != null) {
                instanceToUsers.computeIfAbsent(instanceId, k -> new ArrayList<>()).add(userId);
            }
        }

        log.debug("Fanning out system event {} to {} instances", event.get("eventType"), instanceToUsers.size());

        instanceToUsers.forEach((instanceId, users) -> {
            // We use a Map to send raw JSON
            Map<String, Object> payload = new HashMap<>();
            payload.put("targetUserIds", users);
            payload.put("message", event); // WsMessageListener will broadcast this
            rabbitTemplate.convertAndSend(RabbitMQConfig.WS_EXCHANGE, "server." + instanceId, payload);
        });
    }
}
