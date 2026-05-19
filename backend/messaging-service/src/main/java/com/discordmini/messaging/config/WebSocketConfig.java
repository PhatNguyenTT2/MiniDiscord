package com.discordmini.messaging.config;

import com.discordmini.messaging.handler.StompChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompChannelInterceptor stompChannelInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/chat")
                .setAllowedOrigins("*"); // Gateway handles CORS, but STOMP might still check
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // topic for broadcasting (e.g. room chat), queue for 1-to-1 (e.g.
        // notifications)
        registry.enableSimpleBroker("/topic", "/queue");
        // Prefix for client to send messages to server
        registry.setApplicationDestinationPrefixes("/app");
        // Prefix for user specific queues
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompChannelInterceptor);
    }
}
