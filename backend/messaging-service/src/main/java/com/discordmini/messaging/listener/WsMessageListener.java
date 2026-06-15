package com.discordmini.messaging.listener;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WsMessageListener {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Handles both normal ChatMessage fan-outs and system events
     * (edit/delete/reaction).
     * Both arrive as Map with { targetUserIds: [...], message: {...} }.
     * For ChatMessage: message.roomId exists directly.
     * For system events: message is a Map with eventType, roomId, channelId, etc.
     */
    @SuppressWarnings("unchecked")
    @RabbitListener(queues = "#{instanceQueue.name}")
    public void onTargetedMessage(Map<String, Object> payload) {
        try {
            List<String> targetUserIds = (List<String>) payload.get("targetUserIds");
            Object messageObj = payload.get("message");

            if (messageObj == null) {
                log.warn("Received payload without 'message' field: {}", payload);
                return;
            }

            String roomId = null;

            if (messageObj instanceof Map) {
                Map<String, Object> messageMap = (Map<String, Object>) messageObj;
                roomId = (String) messageMap.get("roomId");
                if (roomId == null) {
                    Object dataVal = messageMap.get("data");
                    if (dataVal instanceof Map) {
                        roomId = (String) ((Map<?, ?>) dataVal).get("roomId");
                    }
                }
            }

            if (roomId == null) {
                log.warn("Could not extract roomId from message payload: {}", payload);
                return;
            }

            log.debug("Received targeted message for {} users, roomId={}",
                    targetUserIds != null ? targetUserIds.size() : 0, roomId);

            // Broadcast the message sub-object to the room topic
            messagingTemplate.convertAndSend("/topic/room." + roomId, messageObj);
        } catch (Exception e) {
            log.error("Failed to process targeted message: {}", e.getMessage(), e);
        }
    }
}
