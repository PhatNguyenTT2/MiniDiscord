package com.discordmini.messaging.service;

import com.discordmini.messaging.model.dto.MusicTrack;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

@Slf4j
@Service
public class MusicExtractionService {

  private final RestTemplate restTemplate = new RestTemplate();

  @Value("${MUSIC_EXTRACTOR_URL:http://localhost:3001}")
  private String extractorUrl;

  /**
   * Call Node.js extractor service to search or resolve song direct audio URL.
   */
  public MusicTrack extractTrack(String query, String requestedBy, String requestedByName) {
    try {
      log.info("Requesting track extraction from: {} for query: {}", extractorUrl, query);

      URI uri = UriComponentsBuilder.fromUriString(extractorUrl)
          .path("/extract")
          .queryParam("q", query)
          .build()
          .toUri();

      @SuppressWarnings("unchecked")
      Map<String, Object> response = restTemplate.getForObject(uri, Map.class);

      if (response == null || !response.containsKey("directUrl")) {
        log.error("Invalid extractor response: {}", response);
        return null;
      }

      int duration = 0;
      if (response.get("duration") instanceof Number) {
        duration = ((Number) response.get("duration")).intValue();
      }

      return MusicTrack.builder()
          .trackId((String) response.get("trackId"))
          .title((String) response.get("title"))
          .directUrl((String) response.get("directUrl"))
          .duration(duration)
          .thumbnail((String) response.get("thumbnail"))
          .requestedBy(requestedBy)
          .requestedByName(requestedByName)
          .build();

    } catch (Exception e) {
      log.error("Failed to extract track metadata for query: {}. Error: {}", query, e.getMessage());
      return null;
    }
  }
}
