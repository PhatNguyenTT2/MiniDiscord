package com.discordmini.groupchannel.service;

import com.discordmini.groupchannel.event.RoomCreatedEvent;
import com.discordmini.groupchannel.model.dto.CreateRoomRequest;
import com.discordmini.groupchannel.model.entity.Channel;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.model.entity.RoomParticipant;
import com.discordmini.groupchannel.model.enums.ChannelType;
import com.discordmini.groupchannel.model.enums.RoomRole;
import com.discordmini.groupchannel.repository.ChannelRepository;
import com.discordmini.groupchannel.repository.RoomParticipantRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import com.discordmini.groupchannel.repository.RoleRepository;
import com.discordmini.groupchannel.repository.RolePermissionRepository;
import com.discordmini.groupchannel.model.entity.Role;
import com.discordmini.groupchannel.model.entity.RolePermission;
import com.discordmini.groupchannel.model.enums.PermissionKey;
import lombok.RequiredArgsConstructor;
import com.discordmini.groupchannel.client.UserServiceClient;
import com.discordmini.groupchannel.model.dto.RoomResponse;
import com.discordmini.groupchannel.model.enums.RoomType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import com.discordmini.common.exception.BaseException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {

        private final RoomRepository roomRepository;
        private final RoomParticipantRepository participantRepository;
        private final ChannelRepository channelRepository;
        private final ApplicationEventPublisher eventPublisher;
        private final UserServiceClient userServiceClient;
        private final MembershipService membershipService;
        private final RoleRepository roleRepository;
        private final RolePermissionRepository rolePermissionRepository;

        @Value("${app.default-room.name:MiniDiscord General}")
        private String defaultRoomName;

        @Transactional
        public Room createRoom(CreateRoomRequest request, UUID ownerId) {
                // 1. Create Room
                Room room = Room.builder()
                                .name(request.getName())
                                .description(request.getDescription())
                                .type(request.getType())
                                .ownerId(ownerId)
                                .build();
                room = roomRepository.save(room);

                // Create Default Roles
                Role everyoneRole = Role.builder()
                                .room(room)
                                .name("@everyone")
                                .position(0)
                                .color("#808080")
                                .build();
                everyoneRole = roleRepository.save(everyoneRole);

                for (PermissionKey key : PermissionKey.values()) {
                        boolean allowed = key == PermissionKey.INVITE_MEMBER || key == PermissionKey.ALLOW_MENTION;
                        rolePermissionRepository.save(RolePermission.builder()
                                        .role(everyoneRole)
                                        .permissionKey(key)
                                        .isAllowed(allowed)
                                        .build());
                }

                Role adminRole = Role.builder()
                                .room(room)
                                .name("Admin")
                                .position(1)
                                .color("#8a2be2")
                                .build();
                adminRole = roleRepository.save(adminRole);

                for (PermissionKey key : PermissionKey.values()) {
                        rolePermissionRepository.save(RolePermission.builder()
                                        .role(adminRole)
                                        .permissionKey(key)
                                        .isAllowed(true)
                                        .build());
                }

                // 2. Add Owner as Participant
                RoomParticipant owner = RoomParticipant.builder()
                                .room(room)
                                .userId(ownerId)
                                .role(RoomRole.OWNER)
                                .roleEntity(adminRole)
                                .build();
                participantRepository.save(owner);

                // 3. Create Default Channel
                Channel defaultChannel = Channel.builder()
                                .room(room)
                                .name("general")
                                .type(ChannelType.TEXT)
                                .position(0)
                                .build();
                channelRepository.save(defaultChannel);

                // 4. Publish Event (Will be handled asynchronously after commit)
                eventPublisher.publishEvent(
                                new RoomCreatedEvent(room.getId(), ownerId, room.getName(), room.getType(), null));

                return room;
        }

        @Transactional(readOnly = true)
        public List<RoomResponse> getMyRooms(UUID userId) {
                List<RoomParticipant> memberships = participantRepository.findByUserIdOrderByJoinedAtAsc(userId);
                List<UUID> roomIds = memberships.stream()
                                .map(p -> p.getRoom().getId())
                                .toList();

                List<Room> rooms = roomRepository.findByIdIn(roomIds);

                return rooms.stream().map(room -> {
                        RoomResponse response = new RoomResponse();
                        response.setId(room.getId());
                        response.setName(room.getName());
                        response.setDescription(room.getDescription());
                        response.setIconUrl(room.getIconUrl());
                        response.setType(room.getType().name());
                        response.setOwnerId(room.getOwnerId());
                        response.setCreatedAt(room.getCreatedAt());
                        response.setUpdatedAt(room.getUpdatedAt());
                        return response;
                }).toList();
        }

        @Transactional(readOnly = true)
        public RoomResponse getRoomDetail(UUID roomId) {
                Room room = roomRepository.findById(roomId)
                                .orElseThrow(() -> new com.discordmini.groupchannel.exception.RoomNotFoundException(
                                                "Room not found"));

                RoomResponse response = new RoomResponse();
                response.setId(room.getId());
                response.setName(room.getName());
                response.setDescription(room.getDescription());
                response.setIconUrl(room.getIconUrl());
                response.setType(room.getType().name());
                response.setOwnerId(room.getOwnerId());
                response.setCreatedAt(room.getCreatedAt());
                response.setUpdatedAt(room.getUpdatedAt());
                return response;
        }

        @Transactional
        public Room getOrCreateRootGroup() {
                return roomRepository.findByNameAndType(defaultRoomName, RoomType.GROUP)
                                .orElseGet(() -> {
                                        Room newRoom = Room.builder()
                                                        .name(defaultRoomName)
                                                        .type(RoomType.GROUP)
                                                        .ownerId(UUID.fromString(
                                                                        "00000000-0000-0000-0000-000000000000")) // System
                                                                                                                 // owner
                                                        .build();
                                        roomRepository.save(newRoom);

                                        Channel generalChannel = Channel.builder()
                                                        .room(newRoom)
                                                        .name("general")
                                                        .type(ChannelType.TEXT)
                                                        .position(0)
                                                        .build();
                                        channelRepository.save(generalChannel);

                                        Channel announcementChannel = Channel.builder()
                                                        .room(newRoom)
                                                        .name("announcements")
                                                        .type(ChannelType.TEXT)
                                                        .position(1)
                                                        .build();
                                        channelRepository.save(announcementChannel);

                                        return newRoom;
                                });
        }

        @Transactional
        public int migrateExistingUsersToRootGroup() {
                Room root = getOrCreateRootGroup();
                List<UUID> allUserIds = userServiceClient.getAllUserIds();
                List<RoomParticipant> participants = participantRepository.findByRoomId(root.getId());
                List<UUID> existingMemberIds = participants.stream()
                                .map(RoomParticipant::getUserId)
                                .toList();

                List<UUID> newUserIds = allUserIds.stream()
                                .filter(id -> !existingMemberIds.contains(id))
                                .toList();

                if (!newUserIds.isEmpty()) {
                        membershipService.batchAddMembers(root.getId(), newUserIds);
                }
                return newUserIds.size();
        }

        @Transactional
        public Room findOrCreateDmRoom(UUID ownerId, UUID targetUserId) {
                List<Room> existingRooms = roomRepository.findDmRoomBetween(ownerId, targetUserId);
                if (!existingRooms.isEmpty()) {
                        return existingRooms.get(0);
                }

                // Create new DM room
                Room room = Room.builder()
                                .name("DM")
                                .type(RoomType.DM)
                                .ownerId(UUID.fromString("00000000-0000-0000-0000-000000000000"))
                                .build();
                room = roomRepository.save(room);

                // Create Default @everyone Role for DM Room
                Role everyoneRole = Role.builder()
                                .room(room)
                                .name("@everyone")
                                .position(0)
                                .color("#808080")
                                .build();
                everyoneRole = roleRepository.save(everyoneRole);

                for (PermissionKey key : PermissionKey.values()) {
                        rolePermissionRepository.save(RolePermission.builder()
                                        .role(everyoneRole)
                                        .permissionKey(key)
                                        .isAllowed(key == PermissionKey.ALLOW_MENTION) // Allow sending text in DM by
                                                                                       // default
                                        .build());
                }

                // Add both users as MEMBER roles for equal DM ownership
                RoomParticipant owner = RoomParticipant.builder()
                                .room(room)
                                .userId(ownerId)
                                .role(RoomRole.MEMBER)
                                .roleEntity(everyoneRole)
                                .build();
                participantRepository.save(owner);

                // Add target user only if it's not self-DM
                if (!ownerId.equals(targetUserId)) {
                        RoomParticipant target = RoomParticipant.builder()
                                        .room(room)
                                        .userId(targetUserId)
                                        .role(RoomRole.MEMBER)
                                        .roleEntity(everyoneRole)
                                        .build();
                        participantRepository.save(target);
                }

                // Create Default Channel for STOMP topic routing
                Channel defaultChannel = Channel.builder()
                                .room(room)
                                .name("general")
                                .type(ChannelType.TEXT)
                                .position(0)
                                .build();
                channelRepository.save(defaultChannel);

                eventPublisher.publishEvent(
                                new RoomCreatedEvent(room.getId(), ownerId, room.getName(), room.getType(),
                                                targetUserId));

                return room;
        }

        @Transactional
        public void transferOwnership(UUID roomId, UUID requesterId, UUID newOwnerId) {
                Room room = roomRepository.findById(roomId)
                                .orElseThrow(() -> new com.discordmini.groupchannel.exception.RoomNotFoundException(
                                                "Room not found"));

                if (!room.getOwnerId().equals(requesterId)) {
                        throw new BaseException("Only the owner can transfer ownership", HttpStatus.FORBIDDEN);
                }

                RoomParticipant newOwnerParticipant = participantRepository.findByUserIdAndRoomId(newOwnerId, roomId)
                                .orElseThrow(() -> new BaseException("New owner must be a member of this room",
                                                HttpStatus.BAD_REQUEST));

                RoomParticipant oldOwnerParticipant = participantRepository.findByUserIdAndRoomId(requesterId, roomId)
                                .orElseThrow(() -> new BaseException("Old owner participant not found",
                                                HttpStatus.INTERNAL_SERVER_ERROR));

                // Let's modify ownership
                room.setOwnerId(newOwnerId);
                roomRepository.save(room);

                // Update participants roles
                oldOwnerParticipant.setRole(RoomRole.ADMIN);
                participantRepository.save(oldOwnerParticipant);

                newOwnerParticipant.setRole(RoomRole.OWNER);
                participantRepository.save(newOwnerParticipant);
        }

        @Transactional
        public void clearDatabase() {
                participantRepository.deleteAll();
                channelRepository.deleteAll();
                roomRepository.deleteAll();
        }
}
