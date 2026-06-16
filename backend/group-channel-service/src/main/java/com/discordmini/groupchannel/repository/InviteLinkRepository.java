package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.InviteLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InviteLinkRepository extends JpaRepository<InviteLink, UUID> {
  Optional<InviteLink> findByCode(String code);

  List<InviteLink> findByRoomId(UUID roomId);

  List<InviteLink> findByRoomIdAndExpiresAtAfter(UUID roomId, Instant now);

  void deleteByExpiresAtBefore(Instant now);

  void deleteByRoomId(UUID roomId);
}
