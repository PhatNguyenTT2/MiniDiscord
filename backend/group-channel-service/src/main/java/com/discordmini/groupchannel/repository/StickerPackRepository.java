package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.StickerPack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface StickerPackRepository extends JpaRepository<StickerPack, UUID> {
}
