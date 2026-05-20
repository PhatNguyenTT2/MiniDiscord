package com.discordmini.messaging.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        
        // Use String serialization for keys
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        
        // Use Jackson serialization for values
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        
        return template;
    }

    @Bean
    public org.springframework.data.redis.listener.RedisMessageListenerContainer redisContainer(
            RedisConnectionFactory connectionFactory, 
            com.discordmini.messaging.service.RedisPubSubService pubSubService) {
            
        org.springframework.data.redis.listener.RedisMessageListenerContainer container = 
            new org.springframework.data.redis.listener.RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        // Retry connection every 5 seconds on connection failures instead of crashing the context
        container.setRecoveryInterval(5000L);
        
        // Listen to all typing and presence channels
        container.addMessageListener(pubSubService, new org.springframework.data.redis.listener.PatternTopic("typing:*"));
        container.addMessageListener(pubSubService, new org.springframework.data.redis.listener.PatternTopic("presence:*"));
        
        return container;
    }
}
