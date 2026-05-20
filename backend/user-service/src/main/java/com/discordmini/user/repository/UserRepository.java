package com.discordmini.user.repository;

import com.discordmini.user.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    List<User> findByUsernameContainingIgnoreCase(String username);

    List<User> findByIdIn(List<UUID> ids);

    @org.springframework.data.jpa.repository.Query("SELECT u.id FROM User u")
    List<UUID> findAllIds();
}
