package com.discordmini.messaging.listener;

import com.discordmini.messaging.model.dto.TargetedMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class WsMessageListener {

    private final SimpMessagingTemplate messagingTemplate;

    @RabbitListener(queues = "#{instanceQueue.name}")
    public void onTargetedMessage(TargetedMessage targetedMessage) {
        log.debug("Received targeted message for {} users", targetedMessage.getTargetUserIds().size());

        String roomId = targetedMessage.getMessage().getRoomId();

        // We have two options here:
        // Option 1: Send directly to each user's private queue
        // for (String userId : targetedMessage.getTargetUserIds()) {
        // messagingTemplate.convertAndSendToUser(userId, "/queue/messages",
        // targetedMessage.getMessage());
        // }

        // Option 2: Broadcast to the room topic on this instance.
        // Spring's SimpleBroker will only deliver to active STOMP subscriptions on this
        // local instance.
        // Since this message was routed to us because these users are on this instance,
        // broadcasting to the topic is efficient and allows clients to handle
        // room-based state easily.
        messagingTemplate.convertAndSend("/topic/room." + roomId, targetedMessage.getMessage());
    }
}
