package com.discordmini.messaging.config;

import com.discordmini.messaging.handler.StompChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompChannelInterceptor stompChannelInterceptor;

    /**
     * Spring Boot auto-configures a TaskScheduler bean.
     * We inject it lazily to avoid circular dependency during startup.
     * This scheduler is REQUIRED for SimpleBroker heartbeat to function.
     */
    private TaskScheduler messageBrokerTaskScheduler;

    @Autowired
    public void setMessageBrokerTaskScheduler(@Lazy TaskScheduler taskScheduler) {
        this.messageBrokerTaskScheduler = taskScheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/chat")
                .setAllowedOrigins("*"); // Gateway handles CORS, but STOMP might still check
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // topic for broadcasting (e.g. room chat), queue for 1-to-1 (e.g.
        // notifications)
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[] { 10000, 10000 }) // 10s server→client, 10s client→server
                .setTaskScheduler(this.messageBrokerTaskScheduler); // Required for heartbeat to fire
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
