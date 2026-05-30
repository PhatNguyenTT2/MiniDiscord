package com.discordmini.chathistory.service;

import com.discordmini.chathistory.client.MembershipClient;
import com.discordmini.chathistory.exception.ForbiddenException;
import com.discordmini.chathistory.model.document.Message;
import com.discordmini.chathistory.model.dto.MessageResponse;
import com.discordmini.chathistory.repository.MessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private MembershipClient membershipClient;

    @Mock
    private MongoTemplate mongoTemplate;

    @InjectMocks
    private MessageService messageService;

    @Test
    void getMessages_Success() {
        String userId = "user1";
        String roomId = "room1";
        String channelId = "channel1";
        Message message = Message.builder().id("1").messageId("msg-uuid-1").content("test").build();

        doNothing().when(membershipClient).verifyMembership(userId, roomId);
        when(messageRepository.findByRoomIdAndChannelIdFilteredUser(eq(roomId), eq(channelId), eq(userId),
                any(PageRequest.class)))
                .thenReturn(List.of(message));

        List<MessageResponse> result = messageService.getMessages(userId, roomId, channelId, null, null, 50);

        assertEquals(1, result.size());
        assertEquals("test", result.get(0).getContent());
        verify(membershipClient).verifyMembership(userId, roomId);
    }

    @Test
    void getMessages_WithLimit_RespectsMaxLimit() {
        String userId = "user1";
        String roomId = "room1";
        String channelId = "channel1";

        doNothing().when(membershipClient).verifyMembership(userId, roomId);
        when(messageRepository.findByRoomIdAndChannelIdFilteredUser(eq(roomId), eq(channelId), eq(userId),
                any(PageRequest.class)))
                .thenReturn(List.of());

        // limit > 100 should be clamped to 100
        messageService.getMessages(userId, roomId, channelId, null, null, 999);

        verify(messageRepository).findByRoomIdAndChannelIdFilteredUser(
                eq(roomId), eq(channelId), eq(userId), argThat(pageable -> pageable.getPageSize() == 100));
    }

    @Test
    void softDeleteMessage_BySender_Success() {
        String userId = "user1";
        String messageId = "msg1";
        Message message = Message.builder().messageId(messageId).senderId(userId).build();

        when(messageRepository.findByMessageId(messageId)).thenReturn(Optional.of(message));

        messageService.softDeleteMessage(userId, messageId, "EVERYONE");

        assertTrue(message.isDeleted());
        assertNotNull(message.getDeletedAt());
        verify(messageRepository).save(message);
    }

    @Test
    void softDeleteMessage_ByOtherUser_ThrowsForbidden() {
        String userId = "user1";
        String messageId = "msg1";
        Message message = Message.builder().messageId(messageId).senderId("user2").build();

        when(messageRepository.findByMessageId(messageId)).thenReturn(Optional.of(message));

        assertThrows(ForbiddenException.class, () -> messageService.softDeleteMessage(userId, messageId, "EVERYONE"));
        verify(messageRepository, never()).save(any());
    }
}
