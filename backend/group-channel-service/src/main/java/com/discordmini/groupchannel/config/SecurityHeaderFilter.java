package com.discordmini.groupchannel.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeaderFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        String uri = request.getRequestURI();

        // Skip for actuator
        if (uri.startsWith("/actuator")) {
            chain.doFilter(req, res);
            return;
        }

        // Skip for inter-service membership check (called by chat-history-service
        // via lb://group-channel-service without X-User-Id header)
        if (uri.matches("/api/rooms/[^/]+/members/[^/]+") && "GET".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        // Skip X-User-Id requirement for public invite preview GET /api/invites/{code}
        if (uri.matches("/api/invites/[^/]+") && "GET".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        String userId = request.getHeader("X-User-Id");

        if (userId == null || userId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"success\":false,\"message\":\"Missing X-User-Id header\"}");
            return;
        }

        chain.doFilter(req, res);
    }
}
