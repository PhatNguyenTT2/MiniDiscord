package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.model.enums.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface RoomRepository extends JpaRepository<Room, UUID> {
    List<Room> findByNameAndType(String name, RoomType type);

    List<Room> findByIdIn(List<UUID> ids);

    @Query("SELECT r FROM Room r WHERE r.type = 'DM' AND r.id IN " +
            "(SELECT rp1.room.id FROM RoomParticipant rp1 WHERE rp1.userId = :user1) AND r.id IN " +
            "(SELECT rp2.room.id FROM RoomParticipant rp2 WHERE rp2.userId = :user2)")
    List<Room> findDmRoomBetween(@Param("user1") UUID user1, @Param("user2") UUID user2);
}
