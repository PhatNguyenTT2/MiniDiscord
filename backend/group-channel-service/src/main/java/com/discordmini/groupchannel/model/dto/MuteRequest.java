package com.discordmini.groupchannel.model.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MuteRequest {
  @NotNull(message = "Duration in minutes is required")
  @Min(value = 1, message = "Duration must be at least 1 minute")
  private Integer durationMinutes;
}
