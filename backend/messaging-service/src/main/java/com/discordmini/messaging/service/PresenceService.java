package com.discordmini.messaging.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class PresenceService {

    private final StringRedisTemplate redisTemplate;
    private final ConnectionManager connectionManager;
    private final RedisPubSubService pubSubService;
    private final org.springframework.amqp.rabbit.core.RabbitTemplate rabbitTemplate;

    private static final String PRESENCE_KEY_PREFIX = "presence:";

    public void setUserOnline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        redisTemplate.opsForValue().set(key, "ONLINE", Duration.ofMinutes(10));
        log.debug("User {} is now ONLINE", userId);
        publishPresenceChange(userId, "ONLINE");
    }

    public void setUserOffline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        redisTemplate.delete(key);
        log.debug("User {} is now OFFLINE", userId);
        publishPresenceChange(userId, "OFFLINE");
    }

    private void publishPresenceChange(String userId, String status) {
        try {
            rabbitTemplate.convertAndSend("user.events", "user.presence.update",
                    java.util.Map.of("userId", userId, "status", status));
        } catch (Exception e) {
            log.error("Failed to publish presence event", e);
        }
    }

    // Layer 2 Zombie Session Cleanup (Review #5)
    @Scheduled(fixedRate = 60000) // Every 60s
    public void cleanZombieSessions() {
        // Refresh valid local connections' TTL
        connectionManager.refreshLocalConnections();

        // Note: Full zombie cleanup across all users requires scanning Redis keys,
        // which might be expensive. Since this is just for local connections,
        // we rely on the 5-min TTL for `conn:user` and 10-min for `presence`.
        // If a server crashes, its keys will naturally expire.
        // A more advanced approach would use a Redis sorted set for heartbeats.
    }
}
