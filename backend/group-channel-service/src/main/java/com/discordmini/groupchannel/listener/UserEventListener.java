package com.discordmini.groupchannel.listener;

import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.model.entity.RoomParticipant;
import com.discordmini.groupchannel.model.event.UserRegisteredEvent;
import com.discordmini.groupchannel.repository.RoomParticipantRepository;
import com.discordmini.groupchannel.service.MembershipService;
import com.discordmini.groupchannel.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserEventListener {

    private final RoomService roomService;
    private final MembershipService membershipService;
    private final RoomParticipantRepository participantRepository;
    private final RabbitTemplate rabbitTemplate;

    @RabbitListener(queues = "${rabbitmq.queues.user-registered}")
    public void onUserRegistered(UserRegisteredEvent event) {
        log.info("Received UserRegisteredEvent for user: {}", event.getUsername());
        try {
            Room rootGroup = roomService.getOrCreateRootGroup();
            membershipService.addMemberIfNotExists(rootGroup.getId(), event.getUserId());
            log.info("Successfully added user {} to root group", event.getUsername());
        } catch (Exception e) {
            log.error("Failed to process UserRegisteredEvent for user: {}", event.getUsername(), e);
        }
    }

    @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "group-channel.user-presence.queue", durable = "true"), exchange = @Exchange(name = "user.events", type = ExchangeTypes.TOPIC), key = "user.presence.update"))
    public void onUserPresenceUpdate(Map<String, String> event) {
        String userIdStr = event.get("userId");
        String status = event.get("status");

        if (userIdStr == null || status == null) {
            log.warn("Received malformed presence update event: {}", event);
            return;
        }

        try {
            UUID userId = UUID.fromString(userIdStr);
            List<RoomParticipant> memberships = participantRepository.findByUserId(userId);

            log.info("Broadcasting presence [{}] of user {} to {} rooms", status, userIdStr, memberships.size());

            for (RoomParticipant parent : memberships) {
                UUID roomId = parent.getRoom().getId();
                try {
                    rabbitTemplate.convertAndSend(
                            "room.events",
                            "member.presence",
                            Map.of(
                                    "roomId", roomId.toString(),
                                    "userId", userIdStr,
                                    "status", status));
                } catch (Exception e) {
                    log.error("Failed to broadcast presence update to room {}", roomId, e);
                }
            }
        } catch (Exception e) {
            log.error("Error processing user presence update for user {}: {}", userIdStr, e.getMessage(), e);
        }
    }
}
