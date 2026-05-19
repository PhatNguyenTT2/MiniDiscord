package com.discordmini.groupchannel.service;

import com.discordmini.groupchannel.exception.RoomNotFoundException;
import com.discordmini.groupchannel.model.dto.ChannelRequest;
import com.discordmini.groupchannel.model.dto.ChannelResponse;
import com.discordmini.groupchannel.model.entity.Channel;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.repository.ChannelRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
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
                .build();

        return channelRepository.save(channel);
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> getChannels(UUID roomId) {
        return channelRepository.findByRoomIdOrderByPositionAsc(roomId).stream()
                .map(this::toResponse)
                .toList();
    }

    private ChannelResponse toResponse(Channel channel) {
        return ChannelResponse.builder()
                .id(channel.getId())
                .roomId(channel.getRoom().getId())
                .name(channel.getName())
                .type(channel.getType().name())
                .position(channel.getPosition())
                .createdAt(channel.getCreatedAt())
                .build();
    }
}
