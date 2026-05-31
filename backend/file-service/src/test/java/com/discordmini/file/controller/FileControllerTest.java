package com.discordmini.file.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.file.exception.FileValidationException;
import com.discordmini.file.exception.GlobalExceptionHandler;
import com.discordmini.file.model.dto.PresignRequest;
import com.discordmini.file.model.dto.PresignResponse;
import com.discordmini.file.service.StorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class FileControllerTest {

        private MockMvc mockMvc;

        @Mock
        private StorageService storageService;

        @InjectMocks
        private FileController fileController;

        private ObjectMapper objectMapper = new ObjectMapper();

        @BeforeEach
        void setUp() {
                mockMvc = MockMvcBuilders.standaloneSetup(fileController)
                                .setControllerAdvice(new GlobalExceptionHandler())
                                .build();
        }

        @Test
        void generatePresignedUpload_Success_Returns200() throws Exception {
                PresignRequest request = PresignRequest.builder()
                                .fileName("test.png")
                                .contentType("image/png")
                                .fileSize(4000L)
                                .build();

                PresignResponse mockResponse = PresignResponse.builder()
                                .uploadUrl("http://upload.url")
                                .viewUrl("http://view.url")
                                .fileKey("user1/2026-05/test.png")
                                .expiresIn(3600)
                                .build();

                when(storageService.generatePresignedUpload(eq("user1"), eq("test.png"), eq("image/png"), eq(4000L),
                                any()))
                                .thenReturn(mockResponse);

                mockMvc.perform(post("/api/files/presign/upload")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request))
                                .header("X-User-Id", "user1"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.uploadUrl").value("http://upload.url"));
        }

        @Test
        void getPresignedViewUrl_Success_Returns200() throws Exception {
                when(storageService.generatePresignedView("user1/2026-05/test.png")).thenReturn("http://view.url");

                mockMvc.perform(get("/api/files/url")
                                .param("key", "user1/2026-05/test.png"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.url").value("http://view.url"));
        }

        @Test
        void deleteFile_Success_Returns200() throws Exception {
                doNothing().when(storageService).deleteFile("user1", "user1/test.png");

                mockMvc.perform(delete("/api/files")
                                .param("key", "user1/test.png")
                                .header("X-User-Id", "user1"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));
        }
}
