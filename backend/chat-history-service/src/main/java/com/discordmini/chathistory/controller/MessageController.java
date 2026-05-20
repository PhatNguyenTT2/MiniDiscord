package com.discordmini.chathistory.controller;

import com.discordmini.chathistory.model.dto.MessageResponse;
import com.discordmini.chathistory.model.dto.ReadReceiptResponse;
import com.discordmini.chathistory.service.MessageService;
import com.discordmini.chathistory.service.ReadReceiptService;
import com.discordmini.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final ReadReceiptService readReceiptService;

    @GetMapping("/rooms/{roomId}/channels/{channelId}")
    public ResponseEntity<ApiResponse<List<MessageResponse>>> getMessages(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @PathVariable String channelId,
            @RequestParam(required = false) String before,
            @RequestParam(defaultValue = "50") int limit) {

        List<MessageResponse> messages = messageService.getMessages(userId, roomId, channelId, before, limit);
        return ResponseEntity.ok(ApiResponse.ok(messages));
    }

    @GetMapping("/rooms/{roomId}/channels/{channelId}/search")
    public ResponseEntity<ApiResponse<List<MessageResponse>>> searchMessages(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @PathVariable String channelId,
            @RequestParam String q,
            @RequestParam(defaultValue = "50") int limit) {

        List<MessageResponse> messages = messageService.searchMessages(userId, roomId, channelId, q, limit);
        return ResponseEntity.ok(ApiResponse.ok(messages));
    }

    @DeleteMapping("/{messageId}")
    public ResponseEntity<ApiResponse<Void>> deleteMessage(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String messageId) {

        messageService.softDeleteMessage(userId, messageId);
        return ResponseEntity.ok(ApiResponse.ok("Message deleted", null));
    }

    @PutMapping("/rooms/{roomId}/channels/{channelId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @PathVariable String channelId,
            @RequestBody Map<String, String> body) {

        readReceiptService.markAsRead(userId, roomId, channelId, body.get("lastReadMessageId"));
        return ResponseEntity.ok(ApiResponse.ok("Marked as read", null));
    }

    @GetMapping("/rooms/{roomId}/channels/{channelId}/unread")
    public ResponseEntity<ApiResponse<ReadReceiptResponse>> getUnreadCount(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @PathVariable String channelId) {

        ReadReceiptResponse unread = readReceiptService.getUnreadCount(userId, roomId, channelId);
        return ResponseEntity.ok(ApiResponse.ok(unread));
    }

    @PostMapping("/danger/clear-db")
    public ResponseEntity<ApiResponse<Void>> clearAllHistory() {
        messageService.clearAllHistory();
        return ResponseEntity.ok(ApiResponse.ok("History cleared successfully", null));
    }
}
