package com.discordmini.user.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.user.model.dto.FriendRequestDTO;
import com.discordmini.user.model.dto.FriendResponse;
import com.discordmini.user.model.dto.PendingFriendResponse;
import com.discordmini.user.service.FriendService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FriendResponse>>> getFriends(Authentication authentication) {
        UUID userId = extractUserId(authentication);
        return ResponseEntity.ok(ApiResponse.ok("Friends fetched", friendService.getFriends(userId)));
    }

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<PendingFriendResponse>>> getPendingRequests(Authentication authentication) {
        UUID userId = extractUserId(authentication);
        return ResponseEntity.ok(ApiResponse.ok("Pending requests fetched", friendService.getPendingRequests(userId)));
    }

    @PostMapping("/request")
    public ResponseEntity<Void> sendFriendRequest(
            Authentication authentication,
            @Valid @RequestBody FriendRequestDTO requestDTO) {
        UUID userId = extractUserId(authentication);
        friendService.sendFriendRequest(userId, requestDTO.getIdentifier());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/accept")
    public ResponseEntity<Void> acceptFriendRequest(
            Authentication authentication,
            @PathVariable UUID id) {
        UUID userId = extractUserId(authentication);
        friendService.acceptFriendRequest(userId, id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> declineOrRemoveFriend(
            Authentication authentication,
            @PathVariable UUID id) {
        UUID userId = extractUserId(authentication);
        friendService.declineOrRemoveFriend(userId, id);
        return ResponseEntity.ok().build();
    }

    private UUID extractUserId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
