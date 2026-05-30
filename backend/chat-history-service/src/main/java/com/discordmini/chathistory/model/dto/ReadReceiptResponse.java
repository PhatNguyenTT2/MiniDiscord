package com.discordmini.chathistory.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReadReceiptResponse {

    private long count;
    private String displayCount; // "99+" if exceeds limit
    private boolean hasMore;
    private String lastReadMessageId; // Matches the cursor position
}
