package com.discordmini.user.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.user.model.dto.UserResponse;
import com.discordmini.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        UserResponse user = userService.getUserById(userId);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable UUID userId) {
        UserResponse user = userService.getUserById(userId);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            Authentication auth,
            @RequestBody Map<String, String> updates) {
        UUID userId = UUID.fromString(auth.getName());
        UserResponse user = userService.updateProfile(
                userId,
                updates.get("username"),
                updates.get("avatarUrl"));
        return ResponseEntity.ok(ApiResponse.ok("Profile updated", user));
    }

    @PutMapping("/me/status")
    public ResponseEntity<ApiResponse<Void>> updateStatus(
            Authentication auth,
            @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(auth.getName());
        userService.updateStatus(userId, body.get("status"));
        return ResponseEntity.ok(ApiResponse.ok("Status updated", null));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<UserResponse>>> searchUsers(@RequestParam String q) {
        return ResponseEntity.ok(ApiResponse.ok(userService.searchUsers(q)));
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<UserResponse>> getUsersByIds(@RequestBody List<UUID> ids) {
        return ResponseEntity.ok(userService.getUsersByIds(ids));
    }

    @GetMapping("/ids")
    public ResponseEntity<List<UUID>> getAllUserIds() {
        return ResponseEntity.ok(userService.getAllUserIds());
    }
}
