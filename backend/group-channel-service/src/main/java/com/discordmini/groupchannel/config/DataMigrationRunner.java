package com.discordmini.groupchannel.config;

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
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataMigrationRunner implements ApplicationRunner {

  private final RoomRepository roomRepository;
  private final RoomParticipantRepository participantRepository;
  private final RoleRepository roleRepository;
  private final RolePermissionRepository rolePermissionRepository;

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    log.info("Starting Role & Permissions migration for existing workspace rooms...");
    try {
      List<Room> rooms = roomRepository.findAll();
      for (Room room : rooms) {
        ensureDefaultRolesAndMigrateParticipants(room);
      }
      log.info("Finished Role & Permissions data migration successfully.");
    } catch (Exception e) {
      log.error("Role & Permissions data migration failed", e);
    }
  }

  private void ensureDefaultRolesAndMigrateParticipants(Room room) {
    List<Role> existingRoles = roleRepository.findByRoomId(room.getId());

    Role everyoneRole = existingRoles.stream()
        .filter(r -> "@everyone".equals(r.getName()))
        .findFirst()
        .orElseGet(() -> createDefaultRole(room, "@everyone", 0));

    Role adminRole = existingRoles.stream()
        .filter(r -> "Admin".equals(r.getName()))
        .findFirst()
        .orElseGet(() -> createDefaultRole(room, "Admin", 1));

    // Ensure default permissions for everyone
    ensurePermissions(everyoneRole, List.of(PermissionKey.INVITE_MEMBER, PermissionKey.ALLOW_MENTION));

    // Ensure Admin has all permissions enabled
    ensurePermissions(adminRole, List.of(PermissionKey.values()));

    // Migrate participants without roleEntity
    List<RoomParticipant> participants = participantRepository.findByRoomId(room.getId());
    boolean updated = false;
    for (RoomParticipant participant : participants) {
      if (participant.getRoleEntity() == null) {
        if (participant.getRole() == RoomRole.OWNER || participant.getRole() == RoomRole.ADMIN) {
          participant.setRoleEntity(adminRole);
        } else {
          participant.setRoleEntity(everyoneRole);
        }
        participantRepository.save(participant);
        updated = true;
      }
    }
    if (updated) {
      log.info("Migrated participants for room: {}", room.getName());
    }
  }

  private Role createDefaultRole(Room room, String name, int position) {
    Role role = Role.builder()
        .room(room)
        .name(name)
        .position(position)
        .color(name.equalsIgnoreCase("Admin") ? "#8a2be2" : "#808080")
        .build();
    role = roleRepository.save(role);
    log.info("Created default role '{}' for room '{}'", name, room.getName());
    return role;
  }

  private void ensurePermissions(Role role, List<PermissionKey> allowedKeys) {
    List<RolePermission> currentPerms = rolePermissionRepository.findByRoleId(role.getId());
    for (PermissionKey key : PermissionKey.values()) {
      boolean isAllowed = allowedKeys.contains(key);
      boolean exists = currentPerms.stream().anyMatch(p -> p.getPermissionKey() == key);
      if (!exists) {
        RolePermission rp = RolePermission.builder()
            .role(role)
            .permissionKey(key)
            .isAllowed(isAllowed)
            .build();
        rolePermissionRepository.save(rp);
      }
    }
  }
}
