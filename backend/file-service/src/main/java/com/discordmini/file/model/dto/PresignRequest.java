package com.discordmini.file.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresignRequest {
  private String fileName;
  private String contentType;
  private Long fileSize;
  private String purpose;
}
