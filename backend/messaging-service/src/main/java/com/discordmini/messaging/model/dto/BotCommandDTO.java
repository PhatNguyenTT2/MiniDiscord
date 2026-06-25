package com.discordmini.messaging.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BotCommandDTO {
  private String roomId;
  private String channelId;
  private String command; // "summarize", "unread"
}
