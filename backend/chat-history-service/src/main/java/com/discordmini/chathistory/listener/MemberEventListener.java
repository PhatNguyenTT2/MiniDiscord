package com.discordmini.chathistory.listener;

import com.discordmini.chathistory.model.document.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component("chatHistoryMemberEventListener")
@RequiredArgsConstructor
public class MemberEventListener {

  private final MongoTemplate mongoTemplate;
  private final RabbitTemplate rabbitTemplate;

  @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "chat-history.room-banned-events.queue", durable = "true"), exchange = @Exchange(name = "room.events", type = ExchangeTypes.TOPIC), key = {
      "member.banned" }))
  public void onMemberBanned(Map<String, Object> event) {
    String roomId = (String) event.get("roomId");
    String userId = (String) event.get("userId");

    if (roomId == null || userId == null) {
      log.warn("Member banned event payload missing roomId or userId: {}", event);
      return;
    }

    log.info("Member banned event received for room {} and user {}. Soft-deleting message history...", roomId, userId);

    Query query = Query.query(Criteria.where("roomId").is(roomId).and("senderId").is(userId));
    List<Message> userMessages = mongoTemplate.find(query, Message.class);

    if (userMessages.isEmpty()) {
      log.info("No messages found for banned user {} in room {}", userId, roomId);
      return;
    }

    log.info("Found {} messages by banned user {} to soft-delete", userMessages.size(), userId);

    Update update = new Update()
        .set("isDeleted", true)
        .set("content", "")
        .set("fileKey", null)
        .set("fileName", null)
        .set("fileSize", null)
        .set("reactions", Collections.emptyList())
        .set("deletedAt", Instant.now());
    mongoTemplate.updateMulti(query, update, Message.class);

    for (Message message : userMessages) {
      Map<String, Object> deleteEvent = new HashMap<>();
      deleteEvent.put("eventType", "MESSAGE_DELETED");
      deleteEvent.put("channelId", message.getChannelId());
      deleteEvent.put("roomId", roomId);
      deleteEvent.put("messageId", message.getMessageId());

      try {
        rabbitTemplate.convertAndSend("chat.exchange", "message.system", deleteEvent);
      } catch (Exception e) {
        log.error("Failed to broadcast MESSAGE_DELETED event for messageId {}", message.getMessageId(), e);
      }
    }
    log.info("Soft-deleted and broadcasted deletion events for user {}'s messages in room {}", userId, roomId);
  }
}
