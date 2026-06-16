package com.discordmini.messaging.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MusicTrack {
  private String trackId;
  private String title;
  private String directUrl;
  private int duration;
  private String thumbnail;
  private String requestedBy;
  private String requestedByName;
}
