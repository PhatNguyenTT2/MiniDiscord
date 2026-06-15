package com.discordmini.groupchannel.model.entity;

import com.discordmini.groupchannel.model.enums.PermissionKey;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "role_permissions", uniqueConstraints = @UniqueConstraint(columnNames = { "role_id", "permission_key" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermission {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "role_id", nullable = false)
  private Role role;

  @Enumerated(EnumType.STRING)
  @Column(name = "permission_key", nullable = false, length = 50)
  private PermissionKey permissionKey;

  @Column(name = "is_allowed", nullable = false)
  @Builder.Default
  private Boolean isAllowed = false;
}
