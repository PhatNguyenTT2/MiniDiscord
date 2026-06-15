package com.discordmini.groupchannel.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleResponse {
  private UUID id;
  private String name;
  private Integer position;
  private String color;
  private Map<String, Boolean> permissions;
}
