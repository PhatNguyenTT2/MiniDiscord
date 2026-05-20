package com.discordmini.groupchannel.client;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.UUID;

@Component
public class UserServiceClient {
    private final WebClient webClient;

    public UserServiceClient(WebClient.Builder builder) {
        this.webClient = builder.baseUrl("lb://user-service").build();
    }

    public List<UserResponse> getUsersByIds(List<UUID> userIds) {
        return webClient.post()
                .uri("/api/users/bulk")
                .bodyValue(userIds)
                .retrieve()
                .bodyToFlux(UserResponse.class)
                .collectList()
                .block();
    }

    public List<UUID> getAllUserIds() {
        return webClient.get()
                .uri("/api/users/ids")
                .retrieve()
                .bodyToFlux(UUID.class)
                .collectList()
                .block();
    }
}
