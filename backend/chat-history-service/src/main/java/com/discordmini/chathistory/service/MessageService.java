package com.discordmini.chathistory.service;

import com.discordmini.chathistory.client.MembershipClient;
import com.discordmini.chathistory.exception.ForbiddenException;
import com.discordmini.chathistory.exception.ResourceNotFoundException;
import com.discordmini.chathistory.model.document.Message;
import com.discordmini.chathistory.model.dto.MessageResponse;
import com.discordmini.chathistory.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final MembershipClient membershipClient;
    private static final int MAX_LIMIT = 100;

    public List<MessageResponse> getMessages(String userId, String roomId, String channelId, String before, int limit) {
        membershipClient.verifyMembership(userId, roomId);

        int clampedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
        PageRequest pageable = PageRequest.of(0, clampedLimit, Sort.by(Sort.Direction.DESC, "_id"));

        List<Message> messages;
        if (before != null && !before.isBlank()) {
            messages = messageRepository.findByRoomIdAndChannelIdBeforeCursor(roomId, channelId, before, pageable);
        } else {
            messages = messageRepository.findByRoomIdAndChannelIdAndIsDeletedFalseOrderByIdDesc(roomId, channelId,
                    pageable);
        }

        // DESC query for cursor pagination, then reverse for chronological display
        // (oldest→newest)
        List<MessageResponse> responses = messages.stream()
                .map(MessageResponse::from)
                .collect(Collectors.toList());
        Collections.reverse(responses);
        return responses;
    }

    public List<MessageResponse> searchMessages(String userId, String roomId, String channelId, String keyword,
            int limit) {
        membershipClient.verifyMembership(userId, roomId);

        int clampedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
        PageRequest pageable = PageRequest.of(0, clampedLimit);

        return messageRepository.searchByContent(roomId, channelId, keyword, pageable)
                .stream().map(MessageResponse::from).toList();
    }

    public void softDeleteMessage(String userId, String messageId) {
        Message message = messageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));

        if (!userId.equals(message.getSenderId())) {
            throw new ForbiddenException("Only the sender can delete this message");
        }

        message.setDeleted(true);
        message.setDeletedAt(Instant.now());
        messageRepository.save(message);
    }
}
