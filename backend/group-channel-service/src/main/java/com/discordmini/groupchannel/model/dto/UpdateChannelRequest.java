package com.discordmini.groupchannel.model.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateChannelRequest {
  @Size(min = 1, max = 100, message = "Channel name must be between 1 and 100 characters")
  private String name;

  @Size(max = 1024, message = "Channel topic cannot exceed 1024 characters")
  private String topic;

  private Boolean isPrivate;
}
