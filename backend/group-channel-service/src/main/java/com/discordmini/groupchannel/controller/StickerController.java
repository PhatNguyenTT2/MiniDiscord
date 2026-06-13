package com.discordmini.groupchannel.controller;

import com.discordmini.common.dto.ApiResponse;
import com.discordmini.groupchannel.model.entity.StickerPack;
import com.discordmini.groupchannel.repository.StickerPackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StickerController {

  private final StickerPackRepository stickerPackRepository;

  @GetMapping("/stickers/packs")
  public ResponseEntity<ApiResponse<List<StickerPack>>> getStickerPacks() {
    List<StickerPack> packs = stickerPackRepository.findAll();
    return ResponseEntity.ok(ApiResponse.ok("Sticker packs fetched successfully", packs));
  }
}
