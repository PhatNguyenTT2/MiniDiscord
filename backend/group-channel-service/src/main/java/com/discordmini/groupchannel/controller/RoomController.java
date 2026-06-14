package com.discordmini.groupchannel.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.groupchannel.model.dto.AddMemberRequest;
import com.discordmini.groupchannel.model.dto.CreateRoomRequest;
import com.discordmini.groupchannel.model.dto.RoomResponse;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.service.MembershipService;
import com.discordmini.groupchannel.service.RoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.discordmini.groupchannel.model.dto.MemberPageResponse;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;
    private final MembershipService membershipService;
    private final com.discordmini.groupchannel.service.InviteLinkService inviteLinkService;
    private final com.discordmini.groupchannel.model.dto.InviteLinkResponse inviteLinkResponseDummy = null; // for
                                                                                                            // compilation
                                                                                                            // confirmation
                                                                                                            // or we can
                                                                                                            // import it

    @PostMapping
    public ResponseEntity<ApiResponse<RoomResponse>> createRoom(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody CreateRoomRequest request) {
        Room room = roomService.createRoom(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Room created successfully", mapToResponse(room)));
    }

    @PostMapping("/dm")
    public ResponseEntity<ApiResponse<RoomResponse>> findOrCreateDm(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody Map<String, String> body) {
        UUID targetUserId = UUID.fromString(body.get("targetUserId"));
        Room room = roomService.findOrCreateDmRoom(userId, targetUserId);
        return ResponseEntity.ok(ApiResponse.ok("DM room fetched", mapToResponse(room)));
    }

    @PostMapping("/{roomId}/members")
    public ResponseEntity<ApiResponse<Void>> addMember(
            @RequestHeader("X-User-Id") UUID requesterId,
            @PathVariable UUID roomId,
            @Valid @RequestBody AddMemberRequest request) {
        membershipService.addMember(roomId, requesterId, request.getUserId());
        return ResponseEntity.ok(ApiResponse.ok("Member added successfully", null));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getMyRooms(@RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(ApiResponse.ok("My rooms fetched", roomService.getMyRooms(userId)));
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<ApiResponse<RoomResponse>> getRoomDetail(@PathVariable UUID roomId) {
        return ResponseEntity.ok(ApiResponse.ok("Room detail fetched", roomService.getRoomDetail(roomId)));
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<ApiResponse<MemberPageResponse>> getMembers(
            @PathVariable UUID roomId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant before) {
        return ResponseEntity
                .ok(ApiResponse.ok("Members fetched", membershipService.getMembersPaginated(roomId, limit, before)));
    }

    @GetMapping("/{roomId}/members/{userId}")
    public ResponseEntity<ApiResponse<Void>> checkMembership(
            @PathVariable UUID roomId,
            @PathVariable UUID userId) {
        membershipService.checkMembership(roomId, userId);
        return ResponseEntity.ok(ApiResponse.ok("Member verified", null));
    }

    @GetMapping("/{roomId}/members/{userId}/pin-privilege")
    public ResponseEntity<ApiResponse<Void>> checkPinPrivilege(
            @PathVariable UUID roomId,
            @PathVariable UUID userId) {
        membershipService.checkPinPrivilege(roomId, userId);
        return ResponseEntity.ok(ApiResponse.ok("Pin privilege verified", null));
    }

    @GetMapping("/root")
    public ResponseEntity<ApiResponse<RoomResponse>> getRootGroup() {
        Room root = roomService.getOrCreateRootGroup();
        return ResponseEntity.ok(ApiResponse.ok("Root group fetched", mapToResponse(root)));
    }

    @PostMapping("/root/migrate-all")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> migrateAll() {
        int count = roomService.migrateExistingUsersToRootGroup();
        return ResponseEntity.ok(ApiResponse.ok("Migration completed", Map.of("migratedCount", count)));
    }

    @PostMapping("/danger/clear-db")
    public ResponseEntity<ApiResponse<Void>> clearDatabase() {
        roomService.clearDatabase();
        return ResponseEntity.ok(ApiResponse.ok("Database cleared successfully", null));
    }

    @PostMapping("/{roomId}/invites")
    public ResponseEntity<ApiResponse<com.discordmini.groupchannel.model.dto.InviteLinkResponse>> createInvite(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID roomId) {
        com.discordmini.groupchannel.model.entity.InviteLink inviteLink = inviteLinkService.createInviteLink(roomId,
                userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Invite link created successfully", mapToInviteResponse(inviteLink)));
    }

    @GetMapping("/{roomId}/invites")
    public ResponseEntity<ApiResponse<List<com.discordmini.groupchannel.model.dto.InviteLinkResponse>>> getActiveInvites(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID roomId) {
        List<com.discordmini.groupchannel.model.dto.InviteLinkResponse> responses = inviteLinkService
                .getActiveInvites(roomId, userId).stream()
                .map(this::mapToInviteResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok("Active invite links fetched", responses));
    }

    @DeleteMapping("/{roomId}/invites/{inviteId}")
    public ResponseEntity<ApiResponse<Void>> deleteInvite(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID roomId,
            @PathVariable UUID inviteId) {
        inviteLinkService.deleteInviteLink(roomId, inviteId, userId);
        return ResponseEntity.ok(ApiResponse.ok("Invite link deleted successfully", null));
    }

    private com.discordmini.groupchannel.model.dto.InviteLinkResponse mapToInviteResponse(
            com.discordmini.groupchannel.model.entity.InviteLink inviteLink) {
        return com.discordmini.groupchannel.model.dto.InviteLinkResponse.builder()
                .id(inviteLink.getId())
                .code(inviteLink.getCode())
                .roomId(inviteLink.getRoom().getId())
                .roomName(inviteLink.getRoom().getName())
                .roomIcon(inviteLink.getRoom().getIconUrl())
                .uses(inviteLink.getUses())
                .expiresAt(inviteLink.getExpiresAt())
                .createdAt(inviteLink.getCreatedAt())
                .build();
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
