package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.Channel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChannelRepository extends JpaRepository<Channel, UUID> {
    List<Channel> findByRoomIdOrderByPositionAsc(UUID roomId);

    long countByRoomId(UUID roomId);

    void deleteByRoomId(UUID roomId);
}
