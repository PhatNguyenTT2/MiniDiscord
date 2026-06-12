package com.discordmini.groupchannel.client;

import lombok.Data;

import java.util.UUID;

@Data
public class UserResponse {
    private UUID id;
    private String username;
    private String email;
    private String avatarUrl;
    private String status;
    private String displayName;
}
