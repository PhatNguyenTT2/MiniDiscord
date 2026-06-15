package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {
  List<Role> findByRoomId(UUID roomId);

  List<Role> findByRoomIdOrderByPositionAsc(UUID roomId);
}
