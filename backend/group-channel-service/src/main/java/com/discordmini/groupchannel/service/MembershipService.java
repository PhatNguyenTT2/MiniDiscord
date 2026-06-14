package com.discordmini.groupchannel.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.groupchannel.exception.RoomNotFoundException;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.model.entity.RoomParticipant;
import com.discordmini.groupchannel.model.enums.RoomRole;
import com.discordmini.groupchannel.repository.RoomParticipantRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import com.discordmini.groupchannel.client.UserResponse;
import com.discordmini.groupchannel.client.UserServiceClient;
import com.discordmini.groupchannel.model.dto.MemberDetailResponse;
import com.discordmini.groupchannel.model.dto.MemberPageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class MembershipService {
    private final RoomParticipantRepository participantRepository;
    private final RoomRepository roomRepository;
    private final UserServiceClient userServiceClient;
    private final RabbitTemplate rabbitTemplate;

    public void validateAdminOrOwner(UUID roomId, UUID userId) {
        RoomParticipant participant = participantRepository.findByUserIdAndRoomId(userId, roomId)
                .orElseThrow(() -> new BaseException("Not a member of this room", HttpStatus.FORBIDDEN, "FORBIDDEN"));

        if (participant.getRole() == RoomRole.MEMBER) {
            throw new BaseException("Requires ADMIN or OWNER role", HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
    }

    public void checkPinPrivilege(UUID roomId, UUID userId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));
        if (room.getType() == com.discordmini.groupchannel.model.enums.RoomType.DM) {
            checkMembership(roomId, userId);
        } else {
            validateAdminOrOwner(roomId, userId);
        }
    }

    public void validateOwner(UUID roomId, UUID userId) {
        RoomParticipant participant = participantRepository.findByUserIdAndRoomId(userId, roomId)
                .orElseThrow(() -> new BaseException("Not a member of this room", HttpStatus.FORBIDDEN, "FORBIDDEN"));

        if (participant.getRole() != RoomRole.OWNER) {
            throw new BaseException("Requires OWNER role", HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
    }

    @Transactional
    public void addMember(UUID roomId, UUID requesterId, UUID targetUserId) {
        validateAdminOrOwner(roomId, requesterId);

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));

        if (participantRepository.existsByUserIdAndRoomId(targetUserId, roomId)) {
            throw new BaseException("User already in room", HttpStatus.CONFLICT, "CONFLICT");
        }

        RoomParticipant newMember = RoomParticipant.builder()
                .room(room)
                .userId(targetUserId)
                .role(RoomRole.MEMBER)
                .build();

        participantRepository.save(newMember);

        log.info("Publishing room.member.added event for room {} and user {}", roomId, targetUserId);
        try {
            rabbitTemplate.convertAndSend("room.events", "room.member.added", java.util.Map.of(
                    "roomId", roomId.toString(),
                    "roomName", room.getName(),
                    "targetUserId", targetUserId.toString(),
                    "invitedById", requesterId.toString()));
        } catch (Exception e) {
            log.error("Failed to publish member added event", e);
        }
    }

    @Transactional
    public void addMemberIfNotExists(UUID roomId, UUID userId) {
        if (!participantRepository.existsByUserIdAndRoomId(userId, roomId)) {
            Room room = roomRepository.findById(roomId)
                    .orElseThrow(() -> new RoomNotFoundException("Room not found"));
            RoomParticipant newMember = RoomParticipant.builder()
                    .room(room)
                    .userId(userId)
                    .role(RoomRole.MEMBER)
                    .build();
            participantRepository.save(newMember);
        }
    }

    @Transactional
    public void batchAddMembers(UUID roomId, List<UUID> userIds) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));

        List<RoomParticipant> participants = userIds.stream()
                .map(userId -> RoomParticipant.builder()
                        .room(room)
                        .userId(userId)
                        .role(RoomRole.MEMBER)
                        .build())
                .toList();

        participantRepository.saveAll(participants);
    }

    public void checkMembership(UUID roomId, UUID userId) {
        if (!participantRepository.existsByUserIdAndRoomId(userId, roomId)) {
            throw new BaseException("Not a member of this room", HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
    }

    public MemberPageResponse getMembersPaginated(UUID roomId, int limit, Instant beforeJoinedAt) {
        int clampedLimit = Math.min(Math.max(limit, 1), 100);
        Pageable pageable = PageRequest.of(0, clampedLimit);

        List<RoomParticipant> participants = (beforeJoinedAt != null)
                ? participantRepository.findByRoomIdAndJoinedAtBeforeOrderByJoinedAtDesc(roomId, beforeJoinedAt,
                        pageable)
                : participantRepository.findByRoomIdOrderByJoinedAtDesc(roomId, pageable);

        if (participants.isEmpty()) {
            return new MemberPageResponse(List.of(), false);
        }

        boolean hasMore = participants.size() == clampedLimit;

        List<UUID> userIds = participants.stream()
                .map(RoomParticipant::getUserId)
                .toList();

        List<UserResponse> users = userServiceClient.getUsersByIds(userIds);

        List<MemberDetailResponse> memberDetails = participants.stream().map(p -> {
            UserResponse user = users.stream()
                    .filter(u -> u.getId().equals(p.getUserId()))
                    .findFirst()
                    .orElse(null);

            return MemberDetailResponse.builder()
                    .userId(p.getUserId())
                    .username(user != null ? user.getUsername() : "Unknown")
                    .avatarUrl(user != null ? user.getAvatarUrl() : null)
                    .status(user != null ? user.getStatus() : "OFFLINE")
                    .role(p.getRole())
                    .joinedAt(p.getJoinedAt())
                    .displayName(
                            user != null ? (user.getDisplayName() != null ? user.getDisplayName() : user.getUsername())
                                    : "Unknown")
                    .build();
        }).toList();

        return new MemberPageResponse(memberDetails, hasMore);
    }
}
