package com.discordmini.file.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.file.model.dto.PresignRequest;
import com.discordmini.file.model.dto.PresignResponse;
import com.discordmini.file.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final StorageService storageService;

    @PostMapping("/presign/upload")
    public ResponseEntity<ApiResponse<PresignResponse>> generatePresignedUpload(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody PresignRequest request) {

        PresignResponse response = storageService.generatePresignedUpload(
                userId, request.getFileName(), request.getContentType(), request.getFileSize(), request.getPurpose());
        return ResponseEntity.ok(ApiResponse.ok("Pre-signed upload URL generated", response));
    }

    @GetMapping("/url")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPresignedViewUrl(
            @RequestParam("key") String fileKey) {

        String url = storageService.generatePresignedView(fileKey);
        // We include expiresIn as an extra meta if frontend needs it, but mostly URL is
        // enough
        return ResponseEntity.ok(ApiResponse.ok("Pre-signed view URL generated", Map.of(
                "url", url,
                "expiresIn", 3600 // We can hardcode or get from constant
        )));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> deleteFile(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam("key") String fileKey) {

        storageService.deleteFile(userId, fileKey);
        return ResponseEntity.ok(ApiResponse.ok("File deleted successfully", null));
    }
}
