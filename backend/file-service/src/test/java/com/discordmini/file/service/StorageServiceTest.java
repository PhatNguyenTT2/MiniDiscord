package com.discordmini.file.service;

import com.discordmini.file.exception.FileValidationException;
import com.discordmini.file.model.dto.PresignResponse;
import io.minio.MinioClient;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.RemoveObjectArgs;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StorageServiceTest {

    @Mock
    private MinioClient minioClient;

    @InjectMocks
    private StorageService storageService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(storageService, "bucketName", "test-bucket");
        ReflectionTestUtils.setField(storageService, "endpoint", "http://localhost:9000");
        ReflectionTestUtils.setField(storageService, "presignExpiry", 3600);
    }

    @Test
    void generatePresignedUpload_ValidImage_ReturnsUrls() throws Exception {
        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("http://presigned.url");

        PresignResponse response = storageService.generatePresignedUpload("user1", "test.png", "image/png", 1024L,
                null);

        assertNotNull(response);
        assertEquals("http://presigned.url", response.getUploadUrl());
        assertEquals("http://presigned.url", response.getViewUrl());
        assertTrue(response.getFileKey().startsWith("user1/"));
        assertTrue(response.getFileKey().endsWith(".png"));

        // Should be called twice (PUT and GET)
        verify(minioClient, times(2)).getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class));
    }

    @Test
    void generatePresignedUpload_MissingFileName_ThrowsException() {
        assertThrows(FileValidationException.class,
                () -> storageService.generatePresignedUpload("user1", "", "image/png", 1024L, null));
    }

    @Test
    void generatePresignedUpload_BlockedExtension_ThrowsException() {
        assertThrows(FileValidationException.class,
                () -> storageService.generatePresignedUpload("user1", "test.exe", "application/octet-stream", 1024L,
                        null));
    }

    @Test
    void generatePresignedUpload_SizeLimitExceeded_ThrowsException() {
        assertThrows(FileValidationException.class,
                () -> storageService.generatePresignedUpload("user1", "test.png", "image/png", 30L * 1024 * 1024,
                        null));
    }

    @Test
    void generatePresignedUpload_SoundPurpose_SizeLimitExceeded_ThrowsException() {
        assertThrows(FileValidationException.class,
                () -> storageService.generatePresignedUpload("user1", "test.mp3", "audio/mpeg", 600L * 1024, "sound"));
    }

    @Test
    void generatePresignedUpload_SoundPurpose_InvalidMime_ThrowsException() {
        assertThrows(FileValidationException.class,
                () -> storageService.generatePresignedUpload("user1", "test.mp4", "video/mp4", 100L * 1024, "sound"));
    }

    @Test
    void generatePresignedView_Success() throws Exception {
        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("http://presigned.get.url");

        String url = storageService.generatePresignedView("user1/xyz.png");

        assertEquals("http://presigned.get.url", url);
        verify(minioClient).getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class));
    }

    @Test
    void deleteFile_OwnFile_Success() throws Exception {
        storageService.deleteFile("user1", "user1/2026-05/abc.png");

        verify(minioClient).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    void deleteFile_OtherUsersFile_ThrowsException() {
        assertThrows(FileValidationException.class, () -> storageService.deleteFile("user1", "user2/2026-05/abc.png"));

        try {
            verify(minioClient, never()).removeObject(any());
        } catch (Exception ignored) {
        }
    }
}
