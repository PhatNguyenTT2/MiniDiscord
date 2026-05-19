package com.discordmini.chathistory.client;

import com.discordmini.chathistory.exception.ForbiddenException;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class MembershipClient {

    private final RestClient restClient;

    public MembershipClient(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("lb://group-channel-service").build();
    }

    public void verifyMembership(String userId, String roomId) {
        try {
            restClient.get()
                    .uri("/api/rooms/{roomId}/members/{userId}", roomId, userId)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        int code = res.getStatusCode().value();
                        if (code == 403 || code == 404) {
                            throw new ForbiddenException("Not a member of this room");
                        }
                        log.warn("Unexpected {} from membership check: room={}, user={}", code, roomId, userId);
                    })
                    .toBodilessEntity();
        } catch (ForbiddenException e) {
            throw e;
        } catch (Exception e) {
            // TODO [SECURITY DEBT]: Remove fail-open before production deployment.
            // Risk: attacker can DDoS group-channel-service to bypass membership checks.
            log.warn("Membership check unavailable, fail-open: {}", e.getMessage());
        }
    }
}
