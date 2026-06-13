package com.discordmini.groupchannel.repository;

import com.discordmini.groupchannel.model.entity.Sticker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface StickerRepository extends JpaRepository<Sticker, UUID> {
}
