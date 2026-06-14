package com.discordmini.gateway.filter;

import com.discordmini.common.security.JwtUtil;
import com.discordmini.gateway.config.FilterErrorHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private final JwtUtil jwtUtil;

    // Whitelist paths that bypass JWT authentication
    private final List<String> openPaths = List.of(
            "/api/auth/",
            "/actuator/",
            "/ws/",
            "/api/invites/");

    public JwtAuthFilter(@Value("${jwt.secret}") String secret) {
        // Expiration is not needed for validation, passing 0
        this.jwtUtil = new JwtUtil(secret, 0L);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // 1. Check if path is open (no auth needed)
        if (isPathOpen(path)) {
            // Attempt to extract token anyway if present, to resolve user downstream
            String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                try {
                    String token = authHeader.substring(7);
                    if (!jwtUtil.isTokenExpired(token)) {
                        String userId = jwtUtil.extractSubject(token);
                        ServerWebExchange mutatedExchange = exchange.mutate()
                                .request(r -> r.header("X-User-Id", userId))
                                .build();
                        return chain.filter(mutatedExchange);
                    }
                } catch (Exception e) {
                    // Ignore token errors on open paths, let them flow as anonymous guests
                }
            }
            return chain.filter(exchange);
        }

        // 2. Extract Authorization header
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return FilterErrorHandler.sendError(
                    exchange,
                    HttpStatus.UNAUTHORIZED,
                    "Missing or invalid Authorization header",
                    "MISSING_TOKEN");
        }

        String token = authHeader.substring(7);

        try {
            // 3. Validate JWT
            if (jwtUtil.isTokenExpired(token)) {
                return FilterErrorHandler.sendError(
                        exchange,
                        HttpStatus.UNAUTHORIZED,
                        "Token has expired",
                        "TOKEN_EXPIRED");
            }

            String userId = jwtUtil.extractSubject(token);

            // 4. Mutate request: add X-User-Id header
            ServerWebExchange mutatedExchange = exchange.mutate()
                    .request(r -> r.header("X-User-Id", userId))
                    .build();

            // 5. Continue chain
            return chain.filter(mutatedExchange);

        } catch (Exception e) {
            return FilterErrorHandler.sendError(
                    exchange,
                    HttpStatus.UNAUTHORIZED,
                    "Invalid token",
                    "INVALID_TOKEN");
        }
    }

    private boolean isPathOpen(String path) {
        return openPaths.stream().anyMatch(path::startsWith);
    }

    @Override
    public int getOrder() {
        return -100; // Run before other filters (but after CORS usually, CORS is handled by
                     // WebFilter earlier)
    }
}
