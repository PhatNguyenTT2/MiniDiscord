package com.discordmini.groupchannel.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberPageResponse {
  private List<MemberDetailResponse> members;
  private boolean hasMore;
}
