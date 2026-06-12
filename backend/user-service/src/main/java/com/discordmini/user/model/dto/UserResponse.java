package com.discordmini.user.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private UUID id;
    private String username;
    private String displayName;
    private String email;
    private String avatarUrl;
    private String status;
    private String role;
    private LocalDateTime createdAt;
    private LocalDateTime lastSeenAt;
}
