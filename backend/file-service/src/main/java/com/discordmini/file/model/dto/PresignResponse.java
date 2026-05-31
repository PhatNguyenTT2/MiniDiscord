package com.discordmini.file.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresignResponse {
  private String uploadUrl;
  private String viewUrl;
  private String fileKey;
  private Integer expiresIn;
}
