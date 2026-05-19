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
import lombok.RequiredArgsConstructor;
import com.discordmini.groupchannel.model.dto.RoomResponse;
import com.discordmini.groupchannel.model.enums.RoomType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

                // 2. Add Owner as Participant
                RoomParticipant owner = RoomParticipant.builder()
                                .room(room)
                                .userId(ownerId)
                                .role(RoomRole.OWNER)
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
                                new RoomCreatedEvent(room.getId(), ownerId, room.getName(), room.getType()));

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
        public Room findOrCreateDmRoom(UUID ownerId, UUID targetUserId) {
                List<Room> existingRooms = roomRepository.findDmRoomBetween(ownerId, targetUserId);
                if (!existingRooms.isEmpty()) {
                        return existingRooms.get(0);
                }

                // Create new DM room
                Room room = Room.builder()
                                .name("DM")
                                .type(RoomType.DM)
                                .ownerId(ownerId)
                                .build();
                room = roomRepository.save(room);

                // Add both users
                RoomParticipant owner = RoomParticipant.builder()
                                .room(room)
                                .userId(ownerId)
                                .role(RoomRole.OWNER)
                                .build();
                participantRepository.save(owner);

                // Add target user only if it's not self-DM (though discord supports it, it's
                // safer to check)
                if (!ownerId.equals(targetUserId)) {
                        RoomParticipant target = RoomParticipant.builder()
                                        .room(room)
                                        .userId(targetUserId)
                                        .role(RoomRole.MEMBER)
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
                                new RoomCreatedEvent(room.getId(), ownerId, room.getName(), room.getType()));

                return room;
        }
}
