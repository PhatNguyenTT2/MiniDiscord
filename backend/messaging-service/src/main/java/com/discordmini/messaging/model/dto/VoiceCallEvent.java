package com.discordmini.messaging.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceCallEvent {
  private String eventType; // "VOICE_CALL"
  private String roomId;
  private String callerId;
  private String callerName;
  private String callerAvatar;
  private String targetUserId;
  private String action; // "RING" | "ACCEPT" | "DECLINE" | "END" | "MISSED"
}
