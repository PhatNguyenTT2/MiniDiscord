package com.discordmini.messaging.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AiWorkerClient {

  private final RestTemplate restTemplate;

  @Value("${MUSIC_EXTRACTOR_URL:http://localhost:3001}")
  private String aiWorkerUrl;

  public AiWorkerClient() {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(5000); // 5s connection establishments
    factory.setReadTimeout(20000); // 20s read timeout to bypass HF API Cold Start blocks
    this.restTemplate = new RestTemplate(factory);
  }

  public String chat(String prompt, String senderName, List<Map<String, String>> history) {
    try {
      String url = aiWorkerUrl + "/ai/chat";
      log.info("Sending chat inference request to ai-worker: {}", url);

      Map<String, Object> request = new HashMap<>();
      request.put("prompt", prompt);
      request.put("senderName", senderName);
      request.put("history", history);

      @SuppressWarnings("unchecked")
      Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
      if (response == null || !response.containsKey("response")) {
        log.error("Invalid AI chat response received: {}", response);
        return "❌ [AI Error]: Received empty answer from server.";
      }

      return (String) response.get("response");
    } catch (Exception e) {
      log.error("Failed to fetch AI chat response: {}", e.getMessage());
      return "❌ [AI Error]: Connection request timed out or failed. Hugging Face could be cold-starting.";
    }
  }

  public String summarize(List<Map<String, String>> messages) {
    try {
      String url = aiWorkerUrl + "/ai/summarize";
      log.info("Sending chat log summarization request to ai-worker: {}", url);

      Map<String, Object> request = new HashMap<>();
      request.put("messages", messages);

      @SuppressWarnings("unchecked")
      Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
      if (response == null || !response.containsKey("summary")) {
        log.error("Invalid AI summarize response received: {}", response);
        return "❌ [AI Error]: Received empty summary from server.";
      }

      return (String) response.get("summary");
    } catch (Exception e) {
      log.error("Failed to fetch AI summarization response: {}", e.getMessage());
      return "❌ [AI Error]: Could not generate summary. Server request failed.";
    }
  }
}
