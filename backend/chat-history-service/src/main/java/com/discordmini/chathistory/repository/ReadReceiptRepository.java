package com.discordmini.chathistory.repository;

import com.discordmini.chathistory.model.document.ReadReceipt;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReadReceiptRepository extends MongoRepository<ReadReceipt, String> {

    Optional<ReadReceipt> findByUserIdAndChannelId(String userId, String channelId);
}
