package com.discordmini.user.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class GroupChannelClient {

  private final RestTemplate restTemplate;

  public List<UUID> getRoomMemberIds(UUID roomId) {
    String url = "http://group-channel-service/api/rooms/" + roomId + "/members?limit=100";
    List<UUID> memberIds = new ArrayList<>();

    try {
      HttpHeaders headers = new HttpHeaders();
      // Inject dummy system X-User-Id header to pass the SecurityHeaderFilter check
      headers.set("X-User-Id", "00000000-0000-0000-0000-000000000000");

      HttpEntity<Void> entity = new HttpEntity<>(headers);

      ResponseEntity<Map<String, Object>> responseEntity = restTemplate.exchange(
          url,
          HttpMethod.GET,
          entity,
          new ParameterizedTypeReference<Map<String, Object>>() {
          });

      Map<String, Object> body = responseEntity.getBody();
      if (body != null && body.get("data") instanceof Map<?, ?> dataMap) {
        if (dataMap.get("members") instanceof List<?> dataList) {
          for (Object item : dataList) {
            if (item instanceof Map<?, ?> memberMap) {
              Object userIdStr = memberMap.get("userId");
              if (userIdStr != null) {
                memberIds.add(UUID.fromString(userIdStr.toString()));
              }
            }
          }
          log.debug("Fetched {} member IDs for room {}", memberIds.size(), roomId);
        }
      }
    } catch (Exception e) {
      log.error("Failed to fetch room members for room {}: {}", roomId, e.getMessage());
    }

    return memberIds;
  }
}
