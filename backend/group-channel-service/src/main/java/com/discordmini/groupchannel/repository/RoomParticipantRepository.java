package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.RoomParticipant;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, UUID> {
    List<RoomParticipant> findByUserId(UUID userId);

    List<RoomParticipant> findByUserIdOrderByJoinedAtAsc(UUID userId);

    List<RoomParticipant> findByRoomId(UUID roomId);

    Optional<RoomParticipant> findByUserIdAndRoomId(UUID userId, UUID roomId);

    boolean existsByUserIdAndRoomId(UUID userId, UUID roomId);

    long countByRoomId(UUID roomId);

    void deleteByRoomId(UUID roomId);

    // Cursor pagination queries
    List<RoomParticipant> findByRoomIdOrderByJoinedAtDesc(UUID roomId, Pageable pageable);

    List<RoomParticipant> findByRoomIdAndJoinedAtBeforeOrderByJoinedAtDesc(UUID roomId, Instant before,
            Pageable pageable);
}
