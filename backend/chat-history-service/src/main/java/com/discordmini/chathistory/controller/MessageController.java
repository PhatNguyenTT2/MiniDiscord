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
            @RequestParam(required = false) String after,
            @RequestParam(defaultValue = "50") int limit) {

        List<MessageResponse> messages = messageService.getMessages(userId, roomId, channelId, before, after, limit);
        return ResponseEntity.ok(ApiResponse.ok(messages));
    }

    @GetMapping("/rooms/{roomId}/channels/{channelId}/search")
    public ResponseEntity<ApiResponse<List<MessageResponse>>> searchMessages(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @PathVariable String channelId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String has,
            @RequestParam(required = false) String mentions,
            @RequestParam(defaultValue = "50") int limit) {

        List<MessageResponse> messages = messageService.advancedSearch(
                userId, roomId, channelId, q, from, has, mentions, limit);
        return ResponseEntity.ok(ApiResponse.ok(messages));
    }

    @DeleteMapping("/{messageId}")
    public ResponseEntity<ApiResponse<Void>> deleteMessage(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String messageId,
            @RequestParam(defaultValue = "EVERYONE") String type) {

        messageService.softDeleteMessage(userId, messageId, type);
        return ResponseEntity.ok(ApiResponse.ok("Message deleted", null));
    }

    @PutMapping("/{messageId}")
    public ResponseEntity<ApiResponse<MessageResponse>> editMessage(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String messageId,
            @RequestBody Map<String, String> body) {

        String newContent = body.get("content");
        if (newContent == null || newContent.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Content is required", "BAD_REQUEST"));
        }

        MessageResponse response = messageService.editMessage(userId, messageId, newContent);
        return ResponseEntity.ok(ApiResponse.ok("Message edited", response));
    }

    @PutMapping("/{messageId}/reactions")
    public ResponseEntity<ApiResponse<MessageResponse>> toggleReaction(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String messageId,
            @RequestBody Map<String, String> body) {

        String emoji = body.get("emoji");
        if (emoji == null || emoji.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Emoji is required", "BAD_REQUEST"));
        }

        MessageResponse response = messageService.toggleReaction(userId, messageId, emoji);
        return ResponseEntity.ok(ApiResponse.ok("Reaction toggled", response));
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

    @PutMapping("/rooms/{roomId}/channels/{channelId}/mark-unread")
    public ResponseEntity<ApiResponse<ReadReceiptResponse>> markAsUnread(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @PathVariable String channelId,
            @RequestBody Map<String, String> body) {

        ReadReceiptResponse result = readReceiptService.markAsUnread(
                userId, roomId, channelId, body.get("messageId"));
        return ResponseEntity.ok(ApiResponse.ok("Marked as unread", result));
    }

    @PutMapping("/{messageId}/pin")
    public ResponseEntity<ApiResponse<MessageResponse>> pinMessage(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String messageId,
            @RequestParam(required = false, defaultValue = "User") String senderName) {
        MessageResponse response = messageService.pinMessage(userId, messageId, senderName);
        return ResponseEntity.ok(ApiResponse.ok("Message pinned", response));
    }

    @PutMapping("/{messageId}/unpin")
    public ResponseEntity<ApiResponse<MessageResponse>> unpinMessage(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String messageId) {
        MessageResponse response = messageService.unpinMessage(userId, messageId);
        return ResponseEntity.ok(ApiResponse.ok("Message unpinned", response));
    }

    @GetMapping("/rooms/{roomId}/channels/{channelId}/pinned")
    public ResponseEntity<ApiResponse<List<MessageResponse>>> getPinnedMessages(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String roomId,
            @PathVariable String channelId) {
        List<MessageResponse> list = messageService.getPinnedMessages(userId, roomId, channelId);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/danger/clear-db")
    public ResponseEntity<ApiResponse<Void>> clearAllHistory() {
        messageService.clearAllHistory();
        return ResponseEntity.ok(ApiResponse.ok("History cleared successfully", null));
    }
}
