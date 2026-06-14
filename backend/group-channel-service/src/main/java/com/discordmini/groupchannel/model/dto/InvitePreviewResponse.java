package com.discordmini.groupchannel.model.dto;

import lombok.*;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvitePreviewResponse {
  private String code;
  private UUID roomId;
  private String roomName;
  private String roomDescription;
  private String roomIcon;
  private Long memberCount;
}
