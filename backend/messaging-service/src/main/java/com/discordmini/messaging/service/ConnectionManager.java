package com.discordmini.messaging.service;

import com.discordmini.messaging.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConnectionManager {

    // Lock-free reads for fast routing
    // Map<UserId, SessionId>
    private final ConcurrentHashMap<String, String> userToSession = new ConcurrentHashMap<>();

    private final StringRedisTemplate redisTemplate;

    public static final String INSTANCE_ID = RabbitMQConfig.INSTANCE_QUEUE;
    private static final String CONN_KEY_PREFIX = "conn:user:";

    public void registerConnection(String userId, String sessionId) {
        userToSession.put(userId, sessionId);

        // Sync to Redis for cross-instance routing, TTL 5 minutes
        String key = CONN_KEY_PREFIX + userId;
        redisTemplate.opsForValue().set(key, INSTANCE_ID, Duration.ofMinutes(5));

        log.info("Registered WS connection for user: {} on instance: {}", userId, INSTANCE_ID);
    }

    public void unregisterConnection(String userId, String sessionId) {
        // Only remove if the session ID matches, to prevent race conditions where a
        // user
        // reconnects quickly and the old disconnect event removes the new session.
        if (userToSession.remove(userId, sessionId)) {
            // Also remove from Redis only if it currently points to this instance
            String key = CONN_KEY_PREFIX + userId;
            String currentInstance = redisTemplate.opsForValue().get(key);
            if (INSTANCE_ID.equals(currentInstance)) {
                redisTemplate.delete(key);
            }
            log.info("Unregistered WS connection for user: {}", userId);
        }
    }

    public String getInstanceForUser(String userId) {
        return redisTemplate.opsForValue().get(CONN_KEY_PREFIX + userId);
    }

    public boolean isLocalUser(String userId) {
        return userToSession.containsKey(userId);
    }

    public java.util.Collection<String> getLocalUserIds() {
        return userToSession.keySet();
    }

    // For scheduled cleanup or heartbeat refresh
    public void refreshLocalConnections() {
        userToSession.forEach((userId, sessionId) -> {
            String key = CONN_KEY_PREFIX + userId;
            redisTemplate.expire(key, Duration.ofMinutes(5));
        });
    }
}
