package com.discordmini.messaging.listener;

import com.discordmini.messaging.service.MessageRouter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class SystemEventListener {

  private final MessageRouter messageRouter;

  // Use a unique queue for the microservice group, but since we want ALL
  // instances to potentially listen,
  // actually we should just let ONE instance of messaging-service receive the
  // edit/delete event,
  // and then it will fan-out to the INSTANCE QUEUES of the connected members!
  // So we need a shared queue for the messaging-service group for system events.
  @RabbitListener(bindings = @QueueBinding(value = @Queue(name = "messaging.system-events.queue", durable = "true"), exchange = @Exchange(name = "chat.exchange", type = ExchangeTypes.TOPIC), key = "message.system"))
  public void onSystemEvent(Map<String, Object> event) {
    log.info("Received system event: {}", event);

    String roomId = (String) event.get("roomId");
    if (roomId == null) {
      log.warn("System event missing roomId: {}", event);
      return;
    }

    // Fan out to connected members
    messageRouter.fanOutSystemEvent(event, roomId);
  }
}
