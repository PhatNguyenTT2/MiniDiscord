package com.discordmini.groupchannel.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.groupchannel.exception.RoomNotFoundException;
import com.discordmini.groupchannel.model.dto.ChannelRequest;
import com.discordmini.groupchannel.model.dto.ChannelResponse;
import com.discordmini.groupchannel.model.dto.UpdateChannelRequest;
import com.discordmini.groupchannel.model.entity.Channel;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.repository.ChannelRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChannelService {
        private final ChannelRepository channelRepository;
        private final RoomRepository roomRepository;
        private final MembershipService membershipService;

        @Transactional
        public Channel createChannel(UUID roomId, UUID requesterId, ChannelRequest request) {
                Room room = roomRepository.findById(roomId)
                                .orElseThrow(() -> new RoomNotFoundException("Room not found"));

                membershipService.validateAdminOrOwner(roomId, requesterId);

                List<Channel> existingChannels = channelRepository.findByRoomIdOrderByPositionAsc(roomId);
                int position = existingChannels.isEmpty() ? 0
                                : existingChannels.get(existingChannels.size() - 1).getPosition() + 1;

                Channel channel = Channel.builder()
                                .room(room)
                                .name(request.getName())
                                .type(request.getType())
                                .position(position)
                                .isPrivate(false)
                                .build();

                return channelRepository.save(channel);
        }

        @Transactional(readOnly = true)
        public List<ChannelResponse> getChannels(UUID roomId) {
                return channelRepository.findByRoomIdOrderByPositionAsc(roomId).stream()
                                .map(this::toResponse)
                                .toList();
        }

        @Transactional
        public ChannelResponse updateChannel(UUID roomId, UUID channelId, UUID requesterId,
                        UpdateChannelRequest request) {
                membershipService.validateAdminOrOwner(roomId, requesterId);

                Channel channel = channelRepository.findById(channelId)
                                .orElseThrow(() -> new RoomNotFoundException("Channel not found"));

                if (!channel.getRoom().getId().equals(roomId)) {
                        throw new BaseException("Channel does not belong to this room", HttpStatus.BAD_REQUEST,
                                        "BAD_REQUEST");
                }

                if (request.getName() != null && !request.getName().isBlank()) {
                        channel.setName(request.getName());
                }
                if (request.getTopic() != null) {
                        channel.setTopic(request.getTopic());
                }
                if (request.getIsPrivate() != null) {
                        channel.setIsPrivate(request.getIsPrivate());
                }

                return toResponse(channelRepository.save(channel));
        }

        @Transactional
        public void deleteChannel(UUID roomId, UUID channelId, UUID requesterId) {
                membershipService.validateOwner(roomId, requesterId);

                Channel channel = channelRepository.findById(channelId)
                                .orElseThrow(() -> new RoomNotFoundException("Channel not found"));

                if (!channel.getRoom().getId().equals(roomId)) {
                        throw new BaseException("Channel does not belong to this room", HttpStatus.BAD_REQUEST,
                                        "BAD_REQUEST");
                }

                long count = channelRepository.countByRoomId(roomId);
                if (count <= 1) {
                        throw new BaseException("Cannot delete the last channel in a server", HttpStatus.BAD_REQUEST,
                                        "BAD_REQUEST");
                }

                channelRepository.delete(channel);
        }

        private ChannelResponse toResponse(Channel channel) {
                return ChannelResponse.builder()
                                .id(channel.getId())
                                .roomId(channel.getRoom().getId())
                                .name(channel.getName())
                                .type(channel.getType().name())
                                .position(channel.getPosition())
                                .createdAt(channel.getCreatedAt())
                                .topic(channel.getTopic())
                                .isPrivate(channel.getIsPrivate())
                                .build();
        }
}
