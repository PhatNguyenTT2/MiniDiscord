package com.discordmini.chathistory.repository;

import com.discordmini.chathistory.model.document.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {

        // Cursor pagination: first page (no cursor)
        @Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, 'deletedForUsers': { '$nin': [?2] } }")
        List<Message> findByRoomIdAndChannelIdFilteredUser(
                        String roomId, String channelId, String userId, Pageable pageable);

        // Cursor pagination: subsequent pages (before cursor, includes cursor message
        // to avoid gap)
        @Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, 'deletedForUsers': { '$nin': [?2] }, '_id': { '$lte': { '$oid': ?3 } } }")
        List<Message> findByRoomIdAndChannelIdFilteredUserBeforeCursor(
                        String roomId, String channelId, String userId, String beforeId, Pageable pageable);

        // Cursor pagination: forward pages (after cursor, exclusive)
        @Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, 'deletedForUsers': { '$nin': [?2] }, '_id': { '$gt': { '$oid': ?3 } } }")
        List<Message> findByRoomIdAndChannelIdFilteredUserAfterCursor(
                        String roomId, String channelId, String userId, String afterId, Pageable pageable);

        // Find by event UUID
        Optional<Message> findByMessageId(String messageId);

        // Text search
        @Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, '$text': { '$search': ?2 } }")
        List<Message> searchByContent(String roomId, String channelId, String keyword, Pageable pageable);
}
