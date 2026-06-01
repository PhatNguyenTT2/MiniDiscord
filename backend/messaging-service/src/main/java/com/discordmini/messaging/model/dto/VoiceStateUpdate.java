package com.discordmini.messaging.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceStateUpdate {
  private String eventType; // "VOICE_STATE_UPDATE"
  private String roomId;
  private String channelId;
  private String userId;
  private String username;
  private String avatarUrl;
  private String action; // "JOIN" | "LEAVE" | "MUTE" | "UNMUTE" | "DEAFEN" | "UNDEAFEN"
}
