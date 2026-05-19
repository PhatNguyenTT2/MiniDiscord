package com.discordmini.groupchannel.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.groupchannel.model.dto.ChannelRequest;
import com.discordmini.groupchannel.model.dto.ChannelResponse;
import com.discordmini.groupchannel.model.entity.Channel;
import com.discordmini.groupchannel.service.ChannelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;

    @PostMapping("/rooms/{roomId}/channels")
    public ResponseEntity<ApiResponse<ChannelResponse>> createChannel(
            @RequestHeader("X-User-Id") UUID requesterId,
            @PathVariable UUID roomId,
            @Valid @RequestBody ChannelRequest request) {
        Channel channel = channelService.createChannel(roomId, requesterId, request);
        ChannelResponse response = ChannelResponse.builder()
                .id(channel.getId())
                .roomId(channel.getRoom().getId())
                .name(channel.getName())
                .type(channel.getType().name())
                .position(channel.getPosition())
                .createdAt(channel.getCreatedAt())
                .build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Channel created successfully", response));
    }

    @GetMapping("/rooms/{roomId}/channels")
    public ResponseEntity<ApiResponse<List<ChannelResponse>>> getChannels(@PathVariable UUID roomId) {
        List<ChannelResponse> channels = channelService.getChannels(roomId);
        return ResponseEntity.ok(ApiResponse.ok("Channels fetched", channels));
    }
}
