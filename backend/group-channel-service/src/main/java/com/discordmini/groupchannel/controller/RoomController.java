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

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;
    private final MembershipService membershipService;

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
    public ResponseEntity<ApiResponse<List<com.discordmini.groupchannel.model.dto.MemberDetailResponse>>> getMembers(
            @PathVariable UUID roomId) {
        return ResponseEntity.ok(ApiResponse.ok("Members fetched", membershipService.getMembers(roomId)));
    }

    @GetMapping("/{roomId}/members/{userId}")
    public ResponseEntity<ApiResponse<Void>> checkMembership(
            @PathVariable UUID roomId,
            @PathVariable UUID userId) {
        membershipService.checkMembership(roomId, userId);
        return ResponseEntity.ok(ApiResponse.ok("Member verified", null));
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
