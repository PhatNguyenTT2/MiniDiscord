package com.discordmini.groupchannel.service;

import com.discordmini.common.exception.BaseException;
import com.discordmini.groupchannel.exception.RoomNotFoundException;
import com.discordmini.groupchannel.model.entity.InviteLink;
import com.discordmini.groupchannel.model.entity.Room;
import com.discordmini.groupchannel.repository.InviteLinkRepository;
import com.discordmini.groupchannel.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InviteLinkService {

  private final InviteLinkRepository inviteLinkRepository;
  private final RoomRepository roomRepository;
  private final MembershipService membershipService;

  private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  private static final SecureRandom RANDOM = new SecureRandom();

  private String generateRandomCode() {
    StringBuilder sb = new StringBuilder(8);
    for (int i = 0; i < 8; i++) {
      sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
    }
    return sb.toString();
  }

  @Transactional
  public InviteLink createInviteLink(UUID roomId, UUID creatorId) {
    membershipService.validatePermission(roomId, creatorId,
        com.discordmini.groupchannel.model.enums.PermissionKey.MANAGE_CHANNEL);

    Room room = roomRepository.findById(roomId)
        .orElseThrow(() -> new RoomNotFoundException("Room not found"));

    String code;
    int attempts = 0;
    do {
      code = generateRandomCode();
      attempts++;
    } while (inviteLinkRepository.findByCode(code).isPresent() && attempts < 10);

    InviteLink inviteLink = InviteLink.builder()
        .room(room)
        .creatorId(creatorId)
        .code(code)
        .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
        .build();

    return inviteLinkRepository.save(inviteLink);
  }

  @Transactional(readOnly = true)
  public List<InviteLink> getActiveInvites(UUID roomId, UUID requesterId) {
    membershipService.validatePermission(roomId, requesterId,
        com.discordmini.groupchannel.model.enums.PermissionKey.INVITE_MEMBER);
    return inviteLinkRepository.findByRoomIdAndExpiresAtAfter(roomId, Instant.now());
  }

  @Transactional
  public void deleteInviteLink(UUID roomId, UUID inviteId, UUID requesterId) {
    membershipService.validatePermission(roomId, requesterId,
        com.discordmini.groupchannel.model.enums.PermissionKey.MANAGE_CHANNEL);
    InviteLink inviteLink = inviteLinkRepository.findById(inviteId)
        .orElseThrow(() -> new BaseException("Invite link not found", HttpStatus.NOT_FOUND));

    if (!inviteLink.getRoom().getId().equals(roomId)) {
      throw new BaseException("Invite link does not belong to this room", HttpStatus.BAD_REQUEST);
    }

    inviteLinkRepository.delete(inviteLink);
  }

  @Transactional(readOnly = true)
  public InviteLink getInviteDetails(String code) {
    InviteLink inviteLink = inviteLinkRepository.findByCode(code)
        .orElseThrow(() -> new BaseException("Invite link not found or expired", HttpStatus.NOT_FOUND));

    if (inviteLink.getExpiresAt().isBefore(Instant.now())) {
      throw new BaseException("Invite link has expired", HttpStatus.BAD_REQUEST, "INVITE_EXPIRED");
    }

    return inviteLink;
  }

  @Transactional
  public Room joinRoomWithCode(String code, UUID userId) {
    InviteLink inviteLink = inviteLinkRepository.findByCode(code)
        .orElseThrow(() -> new BaseException("Invite link not found or expired", HttpStatus.NOT_FOUND));

    if (inviteLink.getExpiresAt().isBefore(Instant.now())) {
      throw new BaseException("Invite link has expired", HttpStatus.BAD_REQUEST, "INVITE_EXPIRED");
    }

    Room room = inviteLink.getRoom();
    membershipService.addMemberIfNotExists(room.getId(), userId);

    inviteLink.setUses(inviteLink.getUses() + 1);
    inviteLinkRepository.save(inviteLink);

    return room;
  }

  @Scheduled(cron = "0 0 2 * * ?")
  @Transactional
  public void cleanExpiredInvites() {
    log.info("Running scheduled cleanup for expired invite links");
    inviteLinkRepository.deleteByExpiresAtBefore(Instant.now());
  }
}
