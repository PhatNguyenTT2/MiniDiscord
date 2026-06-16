package com.discordmini.user.exception;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.common.exception.BaseException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

        @ExceptionHandler(BaseException.class)
        public ResponseEntity<ApiResponse<Void>> handleBaseException(BaseException ex) {
                return ResponseEntity
                                .status(ex.getStatus())
                                .body(ApiResponse.error(ex.getMessage(), ex.getErrorCode()));
        }

        @ExceptionHandler(BadCredentialsException.class)
        public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
                return ResponseEntity
                                .status(HttpStatus.UNAUTHORIZED)
                                .body(ApiResponse.error("Invalid email or password", "INVALID_CREDENTIALS"));
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(
                        MethodArgumentNotValidException ex) {
                Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                                .collect(Collectors.toMap(
                                                FieldError::getField,
                                                fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage()
                                                                : "Invalid",
                                                (a, b) -> a));
                return ResponseEntity
                                .badRequest()
                                .body(ApiResponse.<Map<String, String>>builder()
                                                .success(false)
                                                .message("Validation failed")
                                                .errorCode("VALIDATION_ERROR")
                                                .data(errors)
                                                .timestamp(java.time.LocalDateTime.now())
                                                .build());
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
                log.error("Unhandled exception", ex);
                return ResponseEntity
                                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body(ApiResponse.error("Internal server error", "INTERNAL_ERROR"));
        }
}
