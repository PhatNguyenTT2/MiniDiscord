package com.discordmini.user.service;

import com.discordmini.user.exception.UserNotFoundException;
import com.discordmini.user.model.dto.FriendResponse;
import com.discordmini.user.model.dto.PendingFriendResponse;
import com.discordmini.user.model.dto.UserResponse;
import com.discordmini.user.model.entity.Friendship;
import com.discordmini.user.model.entity.FriendshipStatus;
import com.discordmini.user.model.entity.User;
import com.discordmini.user.model.event.FriendEvent;
import com.discordmini.user.repository.FriendshipRepository;
import com.discordmini.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FriendService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final RabbitTemplate rabbitTemplate;
    private final PresenceService presenceService;

    @Transactional
    public void sendFriendRequest(UUID currentUserId, String identifier) {
        User targetUser;
        if (identifier.contains("@")) {
            targetUser = userRepository.findByEmail(identifier)
                    .orElseThrow(() -> new UserNotFoundException(identifier));
        } else {
            targetUser = userRepository.findByUsername(identifier)
                    .orElseThrow(() -> new UserNotFoundException(identifier));
        }

        if (currentUserId.equals(targetUser.getId())) {
            throw new IllegalArgumentException("Cannot send friend request to yourself");
        }

        if (friendshipRepository.existsFriendship(currentUserId, targetUser.getId())) {
            throw new IllegalStateException("Friendship or request already exists");
        }

        Friendship friendship = Friendship.builder()
                .requesterId(currentUserId)
                .receiverId(targetUser.getId())
                .status(FriendshipStatus.PENDING)
                .build();

        friendshipRepository.save(friendship);

        // Publish event → messaging-service → WebSocket push to receiver
        publishFriendEvent(currentUserId, targetUser.getId(), "FRIEND_REQUEST_SENT");
    }

    @Transactional
    public void acceptFriendRequest(UUID currentUserId, UUID friendshipId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new UserNotFoundException("Friend request not found: " + friendshipId));

        if (!friendship.getReceiverId().equals(currentUserId)) {
            throw new IllegalStateException("Not authorized to accept this request");
        }

        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new IllegalStateException("Friend request is not pending");
        }

        friendship.setStatus(FriendshipStatus.ACCEPTED);
        friendshipRepository.save(friendship);

        // Notify the original requester that their request was accepted
        publishFriendEvent(currentUserId, friendship.getRequesterId(), "FRIEND_ACCEPTED");
    }

    @Transactional
    public void declineOrRemoveFriend(UUID currentUserId, UUID friendshipId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new UserNotFoundException("Friendship not found: " + friendshipId));

        if (!friendship.getRequesterId().equals(currentUserId) && !friendship.getReceiverId().equals(currentUserId)) {
            throw new IllegalStateException("Not authorized to modify this friendship");
        }

        UUID otherUserId = friendship.getRequesterId().equals(currentUserId)
                ? friendship.getReceiverId()
                : friendship.getRequesterId();

        friendshipRepository.delete(friendship);

        // Notify the other party
        publishFriendEvent(currentUserId, otherUserId, "FRIEND_REMOVED");
    }

    @Transactional(readOnly = true)
    public List<FriendResponse> getFriends(UUID currentUserId) {
        List<Friendship> friendships = friendshipRepository.findByRequesterIdOrReceiverId(currentUserId, currentUserId)
                .stream()
                .filter(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                .toList();

        List<UUID> friendIds = new ArrayList<>();
        Map<UUID, Friendship> friendIdToFriendship = new HashMap<>();

        for (Friendship f : friendships) {
            UUID friendId = f.getRequesterId().equals(currentUserId) ? f.getReceiverId() : f.getRequesterId();
            friendIds.add(friendId);
            friendIdToFriendship.put(friendId, f);
        }

        Map<UUID, User> friendMap = userRepository.findByIdIn(friendIds)
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        Map<UUID, String> statusMap = presenceService.getBulkStatus(friendIds);

        List<FriendResponse> responses = new ArrayList<>();
        for (UUID friendId : friendIds) {
            User friend = friendMap.get(friendId);
            if (friend != null) {
                Friendship f = friendIdToFriendship.get(friendId);
                String liveStatus = statusMap.getOrDefault(friendId, friend.getStatus());

                responses.add(FriendResponse.builder()
                        .friendshipId(f.getId())
                        .user(mapToUserResponse(friend, liveStatus))
                        .status(f.getStatus().name())
                        .since(f.getUpdatedAt() != null ? f.getUpdatedAt() : f.getCreatedAt())
                        .build());
            }
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public List<PendingFriendResponse> getPendingRequests(UUID currentUserId) {
        List<Friendship> pendingFriendships = friendshipRepository
                .findByRequesterIdOrReceiverId(currentUserId, currentUserId)
                .stream()
                .filter(f -> f.getStatus() == FriendshipStatus.PENDING)
                .toList();

        List<UUID> otherUserIds = new ArrayList<>();
        for (Friendship f : pendingFriendships) {
            boolean incoming = f.getReceiverId().equals(currentUserId);
            UUID otherUserId = incoming ? f.getRequesterId() : f.getReceiverId();
            otherUserIds.add(otherUserId);
        }

        Map<UUID, User> otherUserMap = userRepository.findByIdIn(otherUserIds)
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        Map<UUID, String> statusMap = presenceService.getBulkStatus(otherUserIds);

        List<PendingFriendResponse> responses = new ArrayList<>();
        for (Friendship f : pendingFriendships) {
            boolean incoming = f.getReceiverId().equals(currentUserId);
            UUID otherUserId = incoming ? f.getRequesterId() : f.getReceiverId();
            User otherUser = otherUserMap.get(otherUserId);

            if (otherUser != null) {
                String liveStatus = statusMap.getOrDefault(otherUserId, otherUser.getStatus());
                responses.add(PendingFriendResponse.builder()
                        .friendshipId(f.getId())
                        .user(mapToUserResponse(otherUser, liveStatus))
                        .incoming(incoming)
                        .requestedAt(f.getCreatedAt())
                        .build());
            }
        }
        return responses;
    }

    private UserResponse mapToUserResponse(User user, String status) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .status(status)
                .build();
    }

    private void publishFriendEvent(UUID fromUserId, UUID toUserId, String type) {
        try {
            rabbitTemplate.convertAndSend("user.events", "user.friend." + type.toLowerCase().replace("_", "."),
                    FriendEvent.builder()
                            .fromUserId(fromUserId)
                            .toUserId(toUserId)
                            .type(type)
                            .build());
        } catch (Exception e) {
            log.error("Failed to publish friend event: {}", type, e);
        }
    }
}
