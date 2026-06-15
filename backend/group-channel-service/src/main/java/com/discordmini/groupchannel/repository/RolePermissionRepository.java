package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, UUID> {
  List<RolePermission> findByRoleId(UUID roleId);

  void deleteByRoleId(UUID roleId);
}
