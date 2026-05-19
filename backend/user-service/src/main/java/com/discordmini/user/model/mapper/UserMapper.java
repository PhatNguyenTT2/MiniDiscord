package com.discordmini.user.model.mapper;

import com.discordmini.user.model.dto.UserResponse;
import com.discordmini.user.model.entity.User;

public class UserMapper {

    private UserMapper() {
    }

    public static UserResponse toResponse(User user) {
        return toResponse(user, user.getStatus());
    }

    public static UserResponse toResponse(User user, String status) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .status(status)
                .role(user.getRole().name())
                .createdAt(user.getCreatedAt())
                .lastSeenAt(user.getLastSeenAt())
                .build();
    }
}
