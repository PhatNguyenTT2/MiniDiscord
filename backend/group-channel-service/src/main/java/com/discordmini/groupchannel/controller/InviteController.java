package com.discordmini.groupchannel.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.groupchannel.model.dto.InvitePreviewResponse;
import com.discordmini.groupchannel.model.dto.RoomResponse;
import com.discordmini.groupchannel.model.entity.InviteLink;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.service.InviteLinkService;
import com.discordmini.groupchannel.repository.RoomParticipantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/invites")
@RequiredArgsConstructor
public class InviteController {

  private final InviteLinkService inviteLinkService;
  private final RoomParticipantRepository participantRepository;

  @GetMapping("/{code}")
  public ResponseEntity<ApiResponse<InvitePreviewResponse>> getInvitePreview(@PathVariable String code) {
    InviteLink inviteLink = inviteLinkService.getInviteDetails(code);
    Room room = inviteLink.getRoom();
    long memberCount = participantRepository.countByRoomId(room.getId());

    InvitePreviewResponse response = InvitePreviewResponse.builder()
        .code(inviteLink.getCode())
        .roomId(room.getId())
        .roomName(room.getName())
        .roomDescription(room.getDescription())
        .roomIcon(room.getIconUrl())
        .memberCount(memberCount)
        .build();

    return ResponseEntity.ok(ApiResponse.ok("Invite preview fetched", response));
  }

  @PostMapping("/{code}/join")
  public ResponseEntity<ApiResponse<RoomResponse>> joinRoom(
      @RequestHeader("X-User-Id") UUID userId,
      @PathVariable String code) {
    Room room = inviteLinkService.joinRoomWithCode(code, userId);
    return ResponseEntity.ok(ApiResponse.ok("Joined room successfully", mapToResponse(room)));
  }

  private RoomResponse mapToResponse(Room room) {
    return RoomResponse.builder()
        .id(room.getId())
        .name(room.getName())
        .description(room.getDescription())
        .iconUrl(room.getIconUrl())
        .type(room.getType().name())
        .ownerId(room.getOwnerId())
        .createdAt(room.getCreatedAt())
        .isActive(room.getIsActive())
        .build();
  }
}
