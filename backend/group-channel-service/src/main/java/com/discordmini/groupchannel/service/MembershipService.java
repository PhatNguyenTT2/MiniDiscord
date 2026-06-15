package com.discordmini.groupchannel.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.groupchannel.exception.RoomNotFoundException;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.model.entity.RoomParticipant;
import com.discordmini.groupchannel.model.enums.RoomRole;
import com.discordmini.groupchannel.repository.RoomParticipantRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import com.discordmini.groupchannel.repository.RoleRepository;
import com.discordmini.groupchannel.repository.RoomBanRepository;
import com.discordmini.groupchannel.model.entity.Role;
import com.discordmini.groupchannel.model.entity.RoomBan;
import com.discordmini.groupchannel.model.enums.PermissionKey;
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
    private final RoleRepository roleRepository;
    private final PermissionService permissionService;
    private final RoomBanRepository roomBanRepository;

    public void validatePermission(UUID roomId, UUID userId, PermissionKey permissionKey) {
        List<String> permissions = permissionService.getMyPermissions(roomId, userId);
        if (!permissions.contains(permissionKey.name())) {
            throw new BaseException("Requires " + permissionKey.name() + " permission", HttpStatus.FORBIDDEN,
                    "FORBIDDEN");
        }
    }

    public void validateAdminOrOwner(UUID roomId, UUID userId) {
        validatePermission(roomId, userId, PermissionKey.MANAGE_CHANNEL);
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

    public void checkDeleteMessagePrivilege(UUID roomId, UUID userId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));
        if (room.getType() == com.discordmini.groupchannel.model.enums.RoomType.DM) {
            checkMembership(roomId, userId);
        } else {
            validatePermission(roomId, userId, PermissionKey.DELETE_ANY_MESSAGE);
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
        validatePermission(roomId, requesterId, PermissionKey.INVITE_MEMBER);

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));

        if (participantRepository.existsByUserIdAndRoomId(targetUserId, roomId)) {
            throw new BaseException("User already in room", HttpStatus.CONFLICT, "CONFLICT");
        }

        Role everyoneRole = roleRepository.findByRoomId(roomId).stream()
                .filter(r -> "@everyone".equals(r.getName()))
                .findFirst()
                .orElse(null);

        RoomParticipant newMember = RoomParticipant.builder()
                .room(room)
                .userId(targetUserId)
                .role(RoomRole.MEMBER)
                .roleEntity(everyoneRole)
                .build();

        participantRepository.save(newMember);

        log.info("Publishing room.member.added event for room {} and user {}", roomId, targetUserId);
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            try {
                                rabbitTemplate.convertAndSend("room.events", "room.member.added", java.util.Map.of(
                                        "roomId", roomId.toString(),
                                        "roomName", room.getName(),
                                        "targetUserId", targetUserId.toString(),
                                        "invitedById", requesterId.toString()));
                            } catch (Exception e) {
                                log.error("Failed to publish member added event after commit", e);
                            }
                        }
                    });
        } else {
            try {
                rabbitTemplate.convertAndSend("room.events", "room.member.added", java.util.Map.of(
                        "roomId", roomId.toString(),
                        "roomName", room.getName(),
                        "targetUserId", targetUserId.toString(),
                        "invitedById", requesterId.toString()));
            } catch (Exception e) {
                log.error("Failed to publish member added event on direct send", e);
            }
        }
    }

    @Transactional
    public void addMemberIfNotExists(UUID roomId, UUID userId) {
        if (!participantRepository.existsByUserIdAndRoomId(userId, roomId)) {
            Room room = roomRepository.findById(roomId)
                    .orElseThrow(() -> new RoomNotFoundException("Room not found"));
            Role everyoneRole = roleRepository.findByRoomId(roomId).stream()
                    .filter(r -> "@everyone".equals(r.getName()))
                    .findFirst()
                    .orElse(null);
            RoomParticipant newMember = RoomParticipant.builder()
                    .room(room)
                    .userId(userId)
                    .role(RoomRole.MEMBER)
                    .roleEntity(everyoneRole)
                    .build();
            participantRepository.save(newMember);
        }
    }

    @Transactional
    public void batchAddMembers(UUID roomId, List<UUID> userIds) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));

        Role everyoneRole = roleRepository.findByRoomId(roomId).stream()
                .filter(r -> "@everyone".equals(r.getName()))
                .findFirst()
                .orElse(null);

        List<RoomParticipant> participants = userIds.stream()
                .map(userId -> RoomParticipant.builder()
                        .room(room)
                        .userId(userId)
                        .role(RoomRole.MEMBER)
                        .roleEntity(everyoneRole)
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
                    .createdAt(user != null ? user.getCreatedAt() : null)
                    .displayName(
                            user != null ? (user.getDisplayName() != null ? user.getDisplayName() : user.getUsername())
                                    : "Unknown")
                    .mutedUntil(p.getMutedUntil())
                    .build();
        }).toList();

        return new MemberPageResponse(memberDetails, hasMore);
    }

    @Transactional
    public void updateMemberRole(UUID roomId, UUID requesterId, UUID targetUserId, RoomRole newRole) {
        validateOwner(roomId, requesterId);

        if (requesterId.equals(targetUserId)) {
            throw new BaseException("Cannot change your own role", HttpStatus.BAD_REQUEST, "BAD_REQUEST");
        }

        RoomParticipant targetParticipant = participantRepository.findByUserIdAndRoomId(targetUserId, roomId)
                .orElseThrow(() -> new BaseException("User is not a member of this room", HttpStatus.NOT_FOUND,
                        "NOT_FOUND"));

        Role targetRoleEntity = roleRepository.findByRoomId(roomId).stream()
                .filter(r -> (newRole == RoomRole.ADMIN ? "Admin" : "@everyone").equalsIgnoreCase(r.getName()))
                .findFirst()
                .orElse(null);

        targetParticipant.setRole(newRole);
        targetParticipant.setRoleEntity(targetRoleEntity);
        participantRepository.save(targetParticipant);

        log.info("Member {} role updated to {} in room {} by owner {}", targetUserId, newRole, roomId, requesterId);
    }

    @Transactional
    public void muteMember(UUID roomId, UUID requesterId, UUID targetUserId, int durationMinutes) {
        validatePermission(roomId, requesterId, PermissionKey.RESTRICT_MEMBER);

        RoomParticipant requester = participantRepository.findByUserIdAndRoomId(requesterId, roomId)
                .orElseThrow(() -> new BaseException("Requester is not a member of this room", HttpStatus.FORBIDDEN));

        RoomParticipant participant = participantRepository.findByUserIdAndRoomId(targetUserId, roomId)
                .orElseThrow(() -> new BaseException("User is not a member of this room", HttpStatus.NOT_FOUND,
                        "NOT_FOUND"));

        if (requester.getRole() == RoomRole.ADMIN) {
            if (participant.getRole() == RoomRole.OWNER || participant.getRole() == RoomRole.ADMIN) {
                throw new BaseException("Admins cannot mute another admin or owner", HttpStatus.FORBIDDEN, "FORBIDDEN");
            }
        }

        Instant mutedUntil = Instant.now().plus(java.time.Duration.ofMinutes(durationMinutes));
        participant.setMutedUntil(mutedUntil);
        participantRepository.save(participant);

        log.info("Member {} muted in room {} until {}", targetUserId, roomId, mutedUntil);

        try {
            rabbitTemplate.convertAndSend("room.events", "member.muted", java.util.Map.of(
                    "roomId", roomId.toString(),
                    "userId", targetUserId.toString(),
                    "durationMinutes", durationMinutes,
                    "mutedUntil", mutedUntil.toString()));
        } catch (Exception e) {
            log.error("Failed to publish member muted event", e);
        }
    }

    @Transactional
    public void banMember(UUID roomId, UUID requesterId, UUID targetUserId, String reason) {
        validatePermission(roomId, requesterId, PermissionKey.BAN_MEMBER);

        if (requesterId.equals(targetUserId)) {
            throw new BaseException("Cannot ban yourself", HttpStatus.BAD_REQUEST, "BAD_REQUEST");
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));
        if (room.getOwnerId().equals(targetUserId)) {
            throw new BaseException("Cannot ban room owner", HttpStatus.FORBIDDEN, "FORBIDDEN");
        }

        RoomParticipant requester = participantRepository.findByUserIdAndRoomId(requesterId, roomId)
                .orElseThrow(() -> new BaseException("Requester is not a member of this room", HttpStatus.FORBIDDEN));

        RoomParticipant target = participantRepository.findByUserIdAndRoomId(targetUserId, roomId)
                .orElseThrow(() -> new BaseException("User is not a member of this room", HttpStatus.NOT_FOUND,
                        "NOT_FOUND"));

        if (requester.getRole() == RoomRole.ADMIN) {
            if (target.getRole() == RoomRole.OWNER || target.getRole() == RoomRole.ADMIN) {
                throw new BaseException("Admins cannot ban another admin or owner", HttpStatus.FORBIDDEN, "FORBIDDEN");
            }
        }

        if (roomBanRepository.existsByRoomIdAndUserId(roomId, targetUserId)) {
            throw new BaseException("User is already banned from this room", HttpStatus.CONFLICT, "CONFLICT");
        }

        RoomBan roomBan = RoomBan.builder()
                .roomId(roomId)
                .userId(targetUserId)
                .bannedBy(requesterId)
                .reason(reason)
                .build();
        roomBanRepository.save(roomBan);

        participantRepository.findByUserIdAndRoomId(targetUserId, roomId)
                .ifPresent(participantRepository::delete);

        log.info("Member {} banned from room {} by {}", targetUserId, roomId, requesterId);

        try {
            rabbitTemplate.convertAndSend("room.events", "member.banned", java.util.Map.of(
                    "roomId", roomId.toString(),
                    "userId", targetUserId.toString(),
                    "bannedBy", requesterId.toString(),
                    "reason", reason != null ? reason : ""));
        } catch (Exception e) {
            log.error("Failed to publish member banned event", e);
        }
    }
}
