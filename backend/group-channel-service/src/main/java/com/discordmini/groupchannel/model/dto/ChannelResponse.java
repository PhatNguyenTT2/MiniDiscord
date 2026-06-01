package com.discordmini.groupchannel.model.dto;

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
public class ChannelResponse {
  private UUID id;
  private UUID roomId;
  private String name;
  private String type;
  private Integer position;
  private LocalDateTime createdAt;
  private String topic;
  private Boolean isPrivate;
}
