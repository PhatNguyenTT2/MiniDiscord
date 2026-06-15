package com.discordmini.messaging.client;

import com.discordmini.common.exception.BaseException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.Collections;

@Slf4j
@Component
public class MembershipClient {

    private final RestClient restClient;
    private final StringRedisTemplate redisTemplate;

    public MembershipClient(RestClient.Builder builder, StringRedisTemplate redisTemplate) {
        this.restClient = builder.baseUrl("lb://group-channel-service").build();
        this.redisTemplate = redisTemplate;
    }

    public Set<String> getRoomMembers(String roomId) {
        String cacheKey = "room:members:" + roomId;
        Set<String> members = redisTemplate.opsForSet().members(cacheKey);
        if (members != null && !members.isEmpty()) {
            return members;
        }

        // Cache miss — fetch and populate
        try {
            var response = restClient.get()
                    .uri("/api/rooms/{roomId}/members", roomId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (response != null && response.get("data") instanceof Map<?, ?> dataMap) {
                if (dataMap.get("members") instanceof List<?> dataList) {
                    Set<String> memberIds = new HashSet<>();
                    for (Object item : dataList) {
                        if (item instanceof Map<?, ?> member) {
                            Object uid = member.get("userId");
                            if (uid != null) {
                                memberIds.add(uid.toString());
                                redisTemplate.opsForSet().add(cacheKey, uid.toString());
                            }
                        }
                    }
                    redisTemplate.expire(cacheKey, Duration.ofMinutes(30));
                    return memberIds;
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch room members for {}: {}", roomId, e.getMessage());
        }

        return Collections.emptySet();
    }

    public void verifyMembership(String userId, String roomId) {
        String cacheKey = "room:members:" + roomId;

        // Check cache first
        Boolean isMember = redisTemplate.opsForSet().isMember(cacheKey, userId);
        if (Boolean.TRUE.equals(isMember)) {
            return;
        }

        // Cache miss — verify via group-channel-service
        try {
            restClient.get()
                    .uri("/api/rooms/{roomId}/members/{userId}", roomId, userId)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        int code = res.getStatusCode().value();
                        if (code == 403 || code == 404) {
                            throw new BaseException("Not a member of this room", HttpStatus.FORBIDDEN);
                        }
                        log.warn("Unexpected {} from membership check: room={}, user={}", code, roomId, userId);
                    })
                    .toBodilessEntity();

            // Pre-populate ALL room members in Redis (not just sender)
            populateRoomMembersCache(roomId, userId);
        } catch (BaseException e) {
            throw e;
        } catch (Exception e) {
            // TODO [SECURITY DEBT]: Remove fail-open before production deployment.
            // Risk: attacker can DDoS group-channel-service to bypass membership checks.
            log.warn("Membership check unavailable, fail-open: {}", e.getMessage());
        }
    }

    private void populateRoomMembersCache(String roomId, String verifiedUserId) {
        String cacheKey = "room:members:" + roomId;
        // Always add verified user immediately
        redisTemplate.opsForSet().add(cacheKey, verifiedUserId);

        try {
            // Fetch all members from group-channel-service
            // Response shape: { "success":true, "data": [{ "userId":"...", ... }] }
            var response = restClient.get()
                    .uri("/api/rooms/{roomId}/members", roomId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {
                    });

            if (response != null && response.get("data") instanceof Map<?, ?> dataMap) {
                if (dataMap.get("members") instanceof List<?> dataList) {
                    for (Object item : dataList) {
                        if (item instanceof Map<?, ?> member) {
                            Object uid = member.get("userId");
                            if (uid != null) {
                                redisTemplate.opsForSet().add(cacheKey, uid.toString());
                            }
                        }
                    }
                    log.debug("Pre-populated {} members for room {}", dataList.size(), roomId);
                }
            }
        } catch (Exception e) {
            log.warn("Could not pre-populate room members cache for {}: {}", roomId, e.getMessage());
        }

        redisTemplate.expire(cacheKey, Duration.ofMinutes(30));
    }
}
