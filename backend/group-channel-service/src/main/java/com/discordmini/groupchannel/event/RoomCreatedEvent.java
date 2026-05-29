package com.discordmini.groupchannel.event;

import com.discordmini.groupchannel.model.enums.RoomType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomCreatedEvent {
    private UUID roomId;
    private UUID ownerId;
    private String name;
    private RoomType type;
    private UUID targetUserId; // For DM rooms: the other participant
}
