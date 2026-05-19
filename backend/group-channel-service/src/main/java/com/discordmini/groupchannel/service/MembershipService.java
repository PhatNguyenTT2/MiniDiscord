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
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MembershipService {
    private final RoomParticipantRepository participantRepository;
    private final RoomRepository roomRepository;
    private final UserServiceClient userServiceClient;

    public void validateAdminOrOwner(UUID roomId, UUID userId) {
        RoomParticipant participant = participantRepository.findByUserIdAndRoomId(userId, roomId)
                .orElseThrow(() -> new BaseException("Not a member of this room", HttpStatus.FORBIDDEN, "FORBIDDEN"));

        if (participant.getRole() == RoomRole.MEMBER) {
            throw new BaseException("Requires ADMIN or OWNER role", HttpStatus.FORBIDDEN, "FORBIDDEN");
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

    public void checkMembership(UUID roomId, UUID userId) {
        if (!participantRepository.existsByUserIdAndRoomId(userId, roomId)) {
            throw new BaseException("Not a member of this room", HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
    }

    public List<MemberDetailResponse> getMembers(UUID roomId) {
        List<RoomParticipant> participants = participantRepository.findByRoomId(roomId);
        if (participants.isEmpty()) {
            return List.of();
        }

        List<UUID> userIds = participants.stream()
                .map(RoomParticipant::getUserId)
                .toList();

        List<UserResponse> users = userServiceClient.getUsersByIds(userIds);

        return participants.stream().map(p -> {
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
                    .build();
        }).toList();
    }
}
