package com.discordmini.groupchannel.model.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.UUID;

@Data
public class BanRequest {
  @NotNull(message = "User ID to ban is required")
  private UUID userId;
  private String reason;
}
