package com.discordmini.groupchannel.config;

import com.discordmini.groupchannel.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RootGroupInitializer implements ApplicationRunner {

    private final RoomService roomService;

    @Value("${app.migrate-existing:false}")
    private boolean migrateExisting;

    @Override
    public void run(ApplicationArguments args) {
        log.info("Checking for root group channel...");
        roomService.getOrCreateRootGroup();
        if (migrateExisting) {
            try {
                log.info("Migrating existing users to root group...");
                int count = roomService.migrateExistingUsersToRootGroup();
                log.info("Migrated {} users to root group.", count);
            } catch (Exception e) {
                log.warn("Migration failed (non-fatal, will retry on next restart): {}", e.getMessage());
            }
        }
        log.info("Root group channel initialized.");
    }
}
