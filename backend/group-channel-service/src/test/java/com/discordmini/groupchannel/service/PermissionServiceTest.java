package com.discordmini.groupchannel.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.groupchannel.model.entity.Role;
import com.discordmini.groupchannel.model.entity.RolePermission;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.model.entity.RoomParticipant;
import com.discordmini.groupchannel.model.enums.PermissionKey;
import com.discordmini.groupchannel.model.enums.RoomRole;
import com.discordmini.groupchannel.repository.RolePermissionRepository;
import com.discordmini.groupchannel.repository.RoomParticipantRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PermissionServiceTest {

  @Mock
  private RoomParticipantRepository participantRepository;

  @Mock
  private RoomRepository roomRepository;

  @Mock
  private RolePermissionRepository rolePermissionRepository;

  @InjectMocks
  private PermissionService permissionService;

  private UUID roomId;
  private UUID userId;
  private Room mockRoom;
  private RoomParticipant mockParticipant;

  @BeforeEach
  void setUp() {
    roomId = UUID.randomUUID();
    userId = UUID.randomUUID();

    mockRoom = Room.builder()
        .id(roomId)
        .name("Test Room")
        .ownerId(UUID.randomUUID()) // not owner
        .build();

    mockParticipant = RoomParticipant.builder()
        .id(UUID.randomUUID())
        .room(mockRoom)
        .userId(userId)
        .role(RoomRole.MEMBER)
        .build();
  }

  @Test
  void getMyPermissions_UserNotMember_ShouldThrowForbidden() {
    when(participantRepository.findByUserIdAndRoomId(userId, roomId)).thenReturn(Optional.empty());

    BaseException ex = assertThrows(BaseException.class, () -> permissionService.getMyPermissions(roomId, userId));

    assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    assertEquals("Not a participant in this room", ex.getMessage());
  }

  @Test
  void getMyPermissions_UserIsOwner_ShouldReturnAllPermissions() {
    mockRoom.setOwnerId(userId); // set as owner
    when(participantRepository.findByUserIdAndRoomId(userId, roomId)).thenReturn(Optional.of(mockParticipant));
    when(roomRepository.findById(roomId)).thenReturn(Optional.of(mockRoom));

    List<String> permissions = permissionService.getMyPermissions(roomId, userId);

    assertEquals(PermissionKey.values().length, permissions.size());
    assertTrue(permissions.contains(PermissionKey.MANAGE_CHANNEL.name()));
    assertTrue(permissions.contains(PermissionKey.BAN_MEMBER.name()));
  }

  @Test
  void getMyPermissions_RegularMember_ShouldReturnAllowedKeyNames() {
    Role mockRole = Role.builder()
        .id(UUID.randomUUID())
        .room(mockRoom)
        .name("@everyone")
        .build();
    mockParticipant.setRoleEntity(mockRole);

    RolePermission manageChannelAllowed = RolePermission.builder()
        .role(mockRole)
        .permissionKey(PermissionKey.MANAGE_CHANNEL)
        .isAllowed(true)
        .build();
    RolePermission inviteForbidden = RolePermission.builder()
        .role(mockRole)
        .permissionKey(PermissionKey.INVITE_MEMBER)
        .isAllowed(false)
        .build();

    when(participantRepository.findByUserIdAndRoomId(userId, roomId)).thenReturn(Optional.of(mockParticipant));
    when(roomRepository.findById(roomId)).thenReturn(Optional.of(mockRoom));
    when(rolePermissionRepository.findByRoleId(mockRole.getId()))
        .thenReturn(List.of(manageChannelAllowed, inviteForbidden));

    List<String> permissions = permissionService.getMyPermissions(roomId, userId);

    assertEquals(1, permissions.size());
    assertTrue(permissions.contains("MANAGE_CHANNEL"));
    assertFalse(permissions.contains("INVITE_MEMBER"));
  }
}
