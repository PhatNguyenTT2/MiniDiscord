package com.discordmini.user.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.user.model.dto.AuthResponse;
import com.discordmini.user.model.dto.LoginRequest;
import com.discordmini.user.model.dto.RegisterRequest;
import com.discordmini.user.model.entity.User;
import com.discordmini.user.model.mapper.UserMapper;
import com.discordmini.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.discordmini.user.model.dto.OAuthRequest;
import com.discordmini.user.model.entity.UserRole;
import com.discordmini.user.model.event.UserRegisteredEvent;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

        @Value("${google.client.id}")
        private String googleClientId;

        private final UserRepository userRepository;
        private final JwtService jwtService;
        private final PasswordEncoder passwordEncoder;
        private final RabbitTemplate rabbitTemplate;

        @Transactional
        public AuthResponse register(RegisterRequest request) {
                if (userRepository.existsByEmail(request.getEmail())) {
                        throw new BaseException("Email already registered", HttpStatus.CONFLICT, "EMAIL_EXISTS");
                }
                if (userRepository.existsByUsername(request.getUsername())) {
                        throw new BaseException("Username already taken", HttpStatus.CONFLICT, "USERNAME_EXISTS");
                }

                User user = User.builder()
                                .username(request.getUsername())
                                .email(request.getEmail())
                                .passwordHash(passwordEncoder.encode(request.getPassword()))
                                .build();

                user = userRepository.save(user);

                // Publish event
                rabbitTemplate.convertAndSend(
                                "user.events",
                                "user.registered",
                                new UserRegisteredEvent(user.getId(), user.getUsername()));

                String token = jwtService.generateToken(
                                user.getId().toString(),
                                user.getEmail(),
                                user.getRole().name());

                return AuthResponse.builder()
                                .token(token)
                                .user(UserMapper.toResponse(user))
                                .build();
        }

        public AuthResponse login(LoginRequest request) {
                User user = userRepository.findByEmail(request.getEmail())
                                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

                if (!user.getIsActive()) {
                        throw new BaseException("Account is deactivated", HttpStatus.FORBIDDEN, "ACCOUNT_INACTIVE");
                }

                if (user.getPasswordHash() == null || user.getPasswordHash().isEmpty()
                                || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
                        throw new BadCredentialsException("Invalid email or password");
                }

                String token = jwtService.generateToken(
                                user.getId().toString(),
                                user.getEmail(),
                                user.getRole().name());

                return AuthResponse.builder()
                                .token(token)
                                .user(UserMapper.toResponse(user))
                                .build();
        }

        public AuthResponse loginWithGoogle(OAuthRequest request) throws Exception {
                GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(),
                                new GsonFactory())
                                .setAudience(Collections.singletonList(googleClientId))
                                .build();

                GoogleIdToken idToken = verifier.verify(request.getIdToken());
                if (idToken == null) {
                        throw new BaseException("Invalid Google Token", HttpStatus.UNAUTHORIZED,
                                        "INVALID_GOOGLE_TOKEN");
                }

                GoogleIdToken.Payload payload = idToken.getPayload();
                String email = payload.getEmail();
                String name = (String) payload.get("name");
                String pictureUrl = (String) payload.get("picture");

                User user = userRepository.findByEmail(email).orElse(null);

                if (user == null) {
                        user = User.builder()
                                        .email(email)
                                        .username(name.replaceAll("\\s+", "").toLowerCase() + "_"
                                                        + UUID.randomUUID().toString().substring(0, 5))
                                        .passwordHash("") // OAuth user doesn't have a system password
                                        .avatarUrl(pictureUrl)
                                        .role(UserRole.USER)
                                        .isActive(true)
                                        .build();
                        user = userRepository.save(user);

                        // Publish event
                        rabbitTemplate.convertAndSend(
                                        "user.events",
                                        "user.registered",
                                        new UserRegisteredEvent(user.getId(), user.getUsername()));
                }

                String token = jwtService.generateToken(
                                user.getId().toString(),
                                user.getEmail(),
                                user.getRole().name());

                return AuthResponse.builder()
                                .token(token)
                                .user(UserMapper.toResponse(user))
                                .build();
        }
}
