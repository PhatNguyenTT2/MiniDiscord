package com.discordmini.messaging.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoiceSignalMessage {
  private String roomId;
  private String channelId;
  private String targetUserId; // Targeted peer ID
  private String type; // "OFFER" | "ANSWER" | "ICE"
  private String payload; // SDP or ICE candidate JSON payload (stringified)
}
