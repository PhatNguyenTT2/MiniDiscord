package com.discordmini.groupchannel.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.groupchannel.model.entity.InviteLink;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.repository.InviteLinkRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InviteLinkServiceTest {

    @Mock
    private InviteLinkRepository inviteLinkRepository;

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private MembershipService membershipService;

    @InjectMocks
    private InviteLinkService inviteLinkService;

    private UUID userId;
    private Room room;
    private InviteLink validInvite;
    private InviteLink expiredInvite;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        room = Room.builder()
                .id(UUID.randomUUID())
                .name("General Room")
                .ownerId(UUID.randomUUID())
                .build();

        validInvite = InviteLink.builder()
                .id(UUID.randomUUID())
                .code("valid123")
                .room(room)
                .uses(0)
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .build();

        expiredInvite = InviteLink.builder()
                .id(UUID.randomUUID())
                .code("expired")
                .room(room)
                .uses(0)
                .expiresAt(Instant.now().minus(1, ChronoUnit.DAYS))
                .build();
    }

    @Test
    void getInviteDetails_Success() {
        when(inviteLinkRepository.findByCode("valid123")).thenReturn(Optional.of(validInvite));

        InviteLink result = inviteLinkService.getInviteDetails("valid123");

        assertNotNull(result);
        assertEquals("valid123", result.getCode());
        verify(inviteLinkRepository, times(1)).findByCode("valid123");
    }

    @Test
    void getInviteDetails_Expired_ShouldThrowException() {
        when(inviteLinkRepository.findByCode("expired")).thenReturn(Optional.of(expiredInvite));

        BaseException exception = assertThrows(BaseException.class, () -> 
            inviteLinkService.getInviteDetails("expired")
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("INVITE_EXPIRED", exception.getErrorCode());
        assertEquals("Invite link has expired", exception.getMessage());
    }

    @Test
    void joinRoomWithCode_Success() {
        when(inviteLinkRepository.findByCode("valid123")).thenReturn(Optional.of(validInvite));
        when(inviteLinkRepository.save(any(InviteLink.class))).thenReturn(validInvite);

        Room result = inviteLinkService.joinRoomWithCode("valid123", userId);

        assertNotNull(result);
        assertEquals(room.getId(), result.getId());
        assertEquals(1, validInvite.getUses()); // uses count incremented
        verify(membershipService, times(1)).addMemberIfNotExists(room.getId(), userId);
        verify(inviteLinkRepository, times(1)).save(validInvite);
    }

    @Test
    void joinRoomWithCode_Expired_ShouldThrowException() {
        when(inviteLinkRepository.findByCode("expired")).thenReturn(Optional.of(expiredInvite));

        BaseException exception = assertThrows(BaseException.class, () -> 
            inviteLinkService.joinRoomWithCode("expired", userId)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("INVITE_EXPIRED", exception.getErrorCode());
        assertEquals("Invite link has expired", exception.getMessage());
    }
}
