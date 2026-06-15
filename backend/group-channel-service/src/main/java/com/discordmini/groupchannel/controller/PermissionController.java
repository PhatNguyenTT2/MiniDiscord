package com.discordmini.groupchannel.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.groupchannel.service.MembershipService;
import com.discordmini.groupchannel.service.PermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms/{roomId}")
@RequiredArgsConstructor
public class PermissionController {

  private final PermissionService permissionService;
  private final MembershipService membershipService;

  @GetMapping("/permissions/my")
  public ResponseEntity<ApiResponse<List<String>>> getMyPermissions(
      @PathVariable UUID roomId,
      @RequestHeader("X-User-Id") UUID userId) {
    List<String> permissions = permissionService.getMyPermissions(roomId, userId);
    return ResponseEntity.ok(ApiResponse.ok("User permissions fetched", permissions));
  }

  @PutMapping("/roles/{roleId}/permissions")
  public ResponseEntity<ApiResponse<Void>> updateRolePermissions(
      @PathVariable UUID roomId,
      @PathVariable UUID roleId,
      @RequestHeader("X-User-Id") UUID userId,
      @RequestBody Map<String, Boolean> permissions) {
    // Enforce that only OWNER can modify roles permissions
    membershipService.validateOwner(roomId, userId);

    permissionService.updateRolePermissions(roomId, roleId, permissions);
    return ResponseEntity.ok(ApiResponse.ok("Role permissions updated successfully", null));
  }

  @GetMapping("/roles")
  public ResponseEntity<ApiResponse<List<com.discordmini.groupchannel.model.dto.RoleResponse>>> getRoomRoles(
      @PathVariable UUID roomId,
      @RequestHeader("X-User-Id") UUID userId) {
    membershipService.checkMembership(roomId, userId);
    List<com.discordmini.groupchannel.model.dto.RoleResponse> roles = permissionService.getRoomRoles(roomId);
    return ResponseEntity.ok(ApiResponse.ok("Room roles fetched successfully", roles));
  }
}
