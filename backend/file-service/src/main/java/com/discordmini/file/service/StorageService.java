package com.discordmini.file.service;

import com.discordmini.file.exception.FileValidationException;
import com.discordmini.file.model.dto.FileResponse;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.TimeUnit;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StorageService {

    private final MinioClient minioClient;

    @Value("${b2.bucket-name}")
    private String bucketName;

    @Value("${b2.endpoint}")
    private String endpoint;

    @Value("${b2.presign-expiry:3600}")
    private int presignExpiry;

    private static final List<String> ALLOWED_MIME_PREFIXES = List.of(
            "image/", "audio/", "video/");

    private static final List<String> ALLOWED_MIME_EXACT = List.of(
            "application/pdf",
            "text/plain",
            "application/zip",
            "application/json",
            "text/csv",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" // pptx
    );

    private static final List<String> BLOCKED_EXTENSIONS = List.of(
            ".exe", ".bat", ".sh", ".ps1", ".cmd", ".msi", ".dll", ".vbs");

    public com.discordmini.file.model.dto.PresignResponse generatePresignedUpload(String userId,
            String originalFilename, String contentType, long fileSize, String purpose) {
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new FileValidationException("File name is missing");
        }

        if (originalFilename.length() > 255) {
            throw new FileValidationException("File name is too long");
        }

        if (fileSize > 25 * 1024 * 1024) { // 25MB max based on old config
            throw new FileValidationException("File size exceeds 25MB limit");
        }

        // 1. Validate Extension
        String lowerName = originalFilename.toLowerCase();
        for (String ext : BLOCKED_EXTENSIONS) {
            if (lowerName.endsWith(ext)) {
                throw new FileValidationException("Executable files are not allowed");
            }
        }

        // 2. Purpose-specific Validation
        if ("sound".equals(purpose)) {
            if (fileSize > 500 * 1024) { // 500KB max for sounds
                throw new FileValidationException("Custom sound exceeds 500KB limit");
            }
            if (!contentType.equals("audio/mpeg") &&
                    !contentType.equals("audio/wav") &&
                    !contentType.equals("audio/ogg")) {
                throw new FileValidationException("Custom sound must be .mp3, .ogg, or .wav");
            }
        }

        // We can't use Tika here since we don't have the file bytes yet.
        // We rely on client's contentType and backend's extension + mime type
        // blocklists.
        if (!isMimeTypeAllowed(contentType)) {
            log.warn("Blocked pre-sign request. Name: {}, Requested MIME: {}", originalFilename, contentType);
            throw new FileValidationException("File type not allowed: " + contentType);
        }

        // 3. Generate key
        String extension = getExtension(originalFilename);
        String fileKey = String.format("%s/%s/%s%s",
                userId,
                YearMonth.now().toString(),
                UUID.randomUUID().toString(),
                extension);

        try {
            // Generate PUT URL for browser to upload directly
            String uploadUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(bucketName)
                            .object(fileKey)
                            .expiry(Math.min(presignExpiry, 604800), TimeUnit.SECONDS) // Max 7 days
                            .build());

            // Generate GET URL for immediate preview after upload
            String viewUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(fileKey)
                            .expiry(Math.min(presignExpiry, 604800), TimeUnit.SECONDS)
                            .build());

            return com.discordmini.file.model.dto.PresignResponse.builder()
                    .uploadUrl(uploadUrl)
                    .viewUrl(viewUrl)
                    .fileKey(fileKey)
                    .expiresIn(presignExpiry)
                    .build();

        } catch (Exception e) {
            log.error("Failed to generate pre-signed URL", e);
            throw new RuntimeException("Failed to generate upload URL");
        }
    }

    public String generatePresignedView(String fileKey) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(fileKey)
                            .expiry(Math.min(presignExpiry, 604800), TimeUnit.SECONDS)
                            .build());
        } catch (Exception e) {
            log.error("Failed to generate view URL for key: {}", fileKey, e);
            throw new RuntimeException("Failed to generate view URL");
        }
    }

    public void deleteFile(String userId, String fileKey) {
        // Enforce that a user can only delete their own files
        if (!fileKey.startsWith(userId + "/")) {
            throw new FileValidationException("You can only delete your own files");
        }

        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileKey)
                            .build());
            log.info("Deleted file: {}", fileKey);
        } catch (Exception e) {
            log.error("Failed to delete file from B2", e);
            throw new RuntimeException("Failed to delete file");
        }
    }

    private boolean isMimeTypeAllowed(String mimeType) {
        if (mimeType == null)
            return false;
        if (ALLOWED_MIME_EXACT.contains(mimeType))
            return true;
        for (String prefix : ALLOWED_MIME_PREFIXES) {
            if (mimeType.startsWith(prefix))
                return true;
        }
        return false;
    }

    private String getExtension(String filename) {
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < filename.length() - 1) {
            return filename.substring(lastDotIndex); // includes the dot
        }
        return "";
    }
}
