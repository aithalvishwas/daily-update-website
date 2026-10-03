package com.dailyupdate.auth;

import com.dailyupdate.common.AuthUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Creates the first manager from MANAGER_* settings when no manager exists yet. */
@Component
public class ManagerSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ManagerSeeder.class);

    private final UserRepository users;
    private final UserService userService;
    private final String name;
    private final String email;
    private final String password;

    public ManagerSeeder(UserRepository users, UserService userService,
            @Value("${app.manager.name}") String name,
            @Value("${app.manager.email}") String email,
            @Value("${app.manager.password}") String password) {
        this.users = users;
        this.userService = userService;
        this.name = name;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank() || users.anyManager()) {
            return;
        }
        if (password.length() < 8) {
            log.warn("MANAGER_PASSWORD is shorter than 8 characters; skipping manager seed");
            return;
        }
        userService.create(name, email, password, null, "Manager", AuthUser.MANAGER);
        log.info("Seeded manager account {}", email);
    }
}
