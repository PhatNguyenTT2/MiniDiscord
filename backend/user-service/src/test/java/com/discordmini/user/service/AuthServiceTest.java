package com.discordmini.user.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.user.model.dto.AuthResponse;
import com.discordmini.user.model.dto.LoginRequest;
import com.discordmini.user.model.dto.RegisterRequest;
import com.discordmini.user.model.entity.User;

import com.discordmini.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import com.discordmini.user.model.entity.UserRole;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private AuthService authService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtService jwtService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, jwtService, passwordEncoder, rabbitTemplate);
    }

    @Test
    void register_Success() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@test.com");
        request.setPassword("123456");

        User savedUser = User.builder()
                .id(UUID.randomUUID())
                .username("testuser")
                .email("test@test.com")
                .passwordHash("hashed-pw")
                .role(UserRole.USER)
                .status("OFFLINE")
                .build();

        when(userRepository.existsByEmail("test@test.com")).thenReturn(false);
        when(userRepository.existsByUsername("testuser")).thenReturn(false);
        when(passwordEncoder.encode("123456")).thenReturn("hashed-pw");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtService.generateToken(anyString(), anyString(), anyString())).thenReturn("jwt-token");

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("jwt-token", response.getToken());
        assertEquals("testuser", response.getUser().getUsername());
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void register_EmailExists_ShouldThrowException() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("test@test.com");

        when(userRepository.existsByEmail("test@test.com")).thenReturn(true);

        BaseException exception = assertThrows(BaseException.class, () -> authService.register(request));
        assertEquals("EMAIL_EXISTS", exception.getErrorCode());
    }

    @Test
    void login_Success() {
        LoginRequest request = new LoginRequest();
        request.setIdentifier("test@test.com");
        request.setPassword("123456");

        User user = User.builder()
                .id(UUID.randomUUID())
                .username("testuser")
                .email("test@test.com")
                .passwordHash("hashed-pw")
                .role(UserRole.USER)
                .status("OFFLINE")
                .build();

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("123456", "hashed-pw")).thenReturn(true);
        when(jwtService.generateToken(anyString(), anyString(), anyString())).thenReturn("jwt-token");

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("jwt-token", response.getToken());
    }

    @Test
    void login_WrongPassword_ShouldThrowException() {
        LoginRequest request = new LoginRequest();
        request.setIdentifier("test@test.com");
        request.setPassword("wrong-pw");

        User user = User.builder()
                .email("test@test.com")
                .passwordHash("hashed-pw")
                .role(UserRole.USER)
                .isActive(true)
                .build();

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-pw", "hashed-pw")).thenReturn(false);

        BadCredentialsException exception = assertThrows(BadCredentialsException.class,
                () -> authService.login(request));
        assertEquals("Invalid email/username or password", exception.getMessage());
    }

    @Test
    void login_OauthUserWithEmptyPassword_ShouldThrowException() {
        LoginRequest request = new LoginRequest();
        request.setIdentifier("oauth@test.com");
        request.setPassword("123456");

        // OAuth user created with empty password
        User user = User.builder()
                .email("oauth@test.com")
                .passwordHash("")
                .role(UserRole.USER)
                .isActive(true)
                .build();

        when(userRepository.findByEmail("oauth@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("123456", "")).thenReturn(false);

        BadCredentialsException exception = assertThrows(BadCredentialsException.class,
                () -> authService.login(request));
        assertEquals("Invalid email/username or password", exception.getMessage());
    }
}
