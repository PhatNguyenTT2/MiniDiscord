package com.discordmini.groupchannel.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.groupchannel.model.entity.Role;
import com.discordmini.groupchannel.model.entity.RolePermission;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.model.entity.RoomParticipant;
import com.discordmini.groupchannel.model.enums.PermissionKey;
import com.discordmini.groupchannel.model.enums.RoomRole;
import com.discordmini.groupchannel.repository.RolePermissionRepository;
import com.discordmini.groupchannel.repository.RoleRepository;
import com.discordmini.groupchannel.repository.RoomParticipantRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PermissionService {

  private final RoomParticipantRepository participantRepository;
  private final RoomRepository roomRepository;
  private final RoleRepository roleRepository;
  private final RolePermissionRepository rolePermissionRepository;
  private final RabbitTemplate rabbitTemplate;

  @Transactional
  public void updateRolePermissions(UUID roomId, UUID roleId, java.util.Map<String, Boolean> newPermissions) {
    Role role = roleRepository.findById(roleId)
        .orElseThrow(() -> new BaseException("Role not found", HttpStatus.NOT_FOUND, "NOT_FOUND"));
    if (!role.getRoom().getId().equals(roomId)) {
      throw new BaseException("Role does not belong to this room", HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }

    for (java.util.Map.Entry<String, Boolean> entry : newPermissions.entrySet()) {
      try {
        PermissionKey key = PermissionKey.valueOf(entry.getKey());
        RolePermission rp = rolePermissionRepository.findByRoleId(roleId).stream()
            .filter(p -> p.getPermissionKey() == key)
            .findFirst()
            .orElseGet(() -> RolePermission.builder()
                .role(role)
                .permissionKey(key)
                .build());
        rp.setIsAllowed(entry.getValue());
        rolePermissionRepository.save(rp);
      } catch (IllegalArgumentException e) {
        log.warn("Invalid permission key received: {}", entry.getKey());
      }
    }

    try {
      java.util.Map<String, Object> event = new java.util.HashMap<>();
      event.put("roomId", roomId.toString());
      event.put("eventType", "PERMISSION_UPDATED");
      rabbitTemplate.convertAndSend("chat.exchange", "message.system", event);
      log.info("Published PERMISSION_UPDATED event for room {} to chat.exchange", roomId);
    } catch (Exception e) {
      log.error("Failed to publish permission updated event", e);
    }
  }

  @Transactional(readOnly = true)
  public List<String> getMyPermissions(UUID roomId, UUID userId) {
    RoomParticipant participant = participantRepository.findByUserIdAndRoomId(userId, roomId)
        .orElseThrow(() -> new BaseException("Not a participant in this room", HttpStatus.FORBIDDEN, "FORBIDDEN"));

    Room room = roomRepository.findById(roomId)
        .orElseThrow(() -> new BaseException("Room not found", HttpStatus.NOT_FOUND, "NOT_FOUND"));

    if (room.getOwnerId().equals(userId) || participant.getRole() == RoomRole.OWNER) {
      return Arrays.stream(PermissionKey.values())
          .map(Enum::name)
          .collect(Collectors.toList());
    }

    Role role = participant.getRoleEntity();
    if (role == null) {
      return List.of();
    }

    List<RolePermission> permissions = rolePermissionRepository.findByRoleId(role.getId());
    return permissions.stream()
        .filter(RolePermission::getIsAllowed)
        .map(p -> p.getPermissionKey().name())
        .collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  public List<com.discordmini.groupchannel.model.dto.RoleResponse> getRoomRoles(UUID roomId) {
    List<Role> roles = roleRepository.findByRoomIdOrderByPositionAsc(roomId);
    return roles.stream().map(role -> {
      List<RolePermission> rps = rolePermissionRepository.findByRoleId(role.getId());
      java.util.Map<String, Boolean> permissionsMap = new java.util.HashMap<>();
      for (PermissionKey key : PermissionKey.values()) {
        boolean isAllowed = rps.stream()
            .filter(p -> p.getPermissionKey() == key)
            .findFirst()
            .map(RolePermission::getIsAllowed)
            .orElse(false);
        permissionsMap.put(key.name(), isAllowed);
      }
      return com.discordmini.groupchannel.model.dto.RoleResponse.builder()
          .id(role.getId())
          .name(role.getName())
          .position(role.getPosition())
          .color(role.getColor())
          .permissions(permissionsMap)
          .build();
    }).collect(Collectors.toList());
  }
}
