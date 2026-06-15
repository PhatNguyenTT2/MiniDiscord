package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.RoomBan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoomBanRepository extends JpaRepository<RoomBan, UUID> {
  Optional<RoomBan> findByRoomIdAndUserId(UUID roomId, UUID userId);

  boolean existsByRoomIdAndUserId(UUID roomId, UUID userId);
}
