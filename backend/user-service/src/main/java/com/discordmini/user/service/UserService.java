package com.discordmini.user.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.user.exception.UserNotFoundException;
import com.discordmini.user.model.dto.UserResponse;
import com.discordmini.user.model.entity.User;
import com.discordmini.user.model.mapper.UserMapper;
import com.discordmini.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PresenceService presenceService;

    public UserResponse getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        String liveStatus = presenceService.getUserStatus(userId);
        return UserMapper.toResponse(user, liveStatus);
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, String username, String avatarUrl) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (username != null && !username.equals(user.getUsername())) {
            if (userRepository.existsByUsername(username)) {
                throw new BaseException("Username already taken", HttpStatus.CONFLICT, "USERNAME_EXISTS");
            }
            user.setUsername(username);
        }

        if (avatarUrl != null) {
            user.setAvatarUrl(avatarUrl);
        }

        user = userRepository.save(user);
        String liveStatus = presenceService.getUserStatus(userId);
        return UserMapper.toResponse(user, liveStatus);
    }

    @Transactional
    public void updateStatus(UUID userId, String status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        user.setStatus(status);
        user.setLastSeenAt(LocalDateTime.now());
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> searchUsers(String query) {
        List<User> users = userRepository.findByUsernameContainingIgnoreCase(query);
        List<UUID> ids = users.stream().map(User::getId).toList();
        Map<UUID, String> statusMap = presenceService.getBulkStatus(ids);
        return users.stream()
                .map(u -> UserMapper.toResponse(u, statusMap.getOrDefault(u.getId(), u.getStatus())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsersByIds(List<UUID> ids) {
        List<User> users = userRepository.findByIdIn(ids);
        Map<UUID, String> statusMap = presenceService.getBulkStatus(ids);
        return users.stream()
                .map(u -> UserMapper.toResponse(u, statusMap.getOrDefault(u.getId(), u.getStatus())))
                .toList();
    }
}
