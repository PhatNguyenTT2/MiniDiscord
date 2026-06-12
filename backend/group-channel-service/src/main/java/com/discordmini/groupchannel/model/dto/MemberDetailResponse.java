package com.discordmini.groupchannel.model.dto;

import com.discordmini.groupchannel.model.enums.RoomRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberDetailResponse {
    private UUID userId;
    private String username;
    private String avatarUrl;
    private String status;
    private RoomRole role;
    private Instant joinedAt;
    private String displayName;
}
