package com.dailyupdate.auth;

import com.dailyupdate.common.AuthUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Creates the first admin (ADMIN_*) and first manager (MANAGER_*) when none exists yet. */
@Component
public class ManagerSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ManagerSeeder.class);

    private record Seed(String role, String position, String name, String email, String password) {}

    private final UserRepository users;
    private final UserService userService;
    private final Seed admin;
    private final Seed manager;

    public ManagerSeeder(UserRepository users, UserService userService,
            @Value("${app.admin.name}") String adminName,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.admin.password}") String adminPassword,
            @Value("${app.manager.name}") String name,
            @Value("${app.manager.email}") String email,
            @Value("${app.manager.password}") String password) {
        this.users = users;
        this.userService = userService;
        this.admin = new Seed(AuthUser.ADMIN, "Admin", adminName, adminEmail, adminPassword);
        this.manager = new Seed(AuthUser.MANAGER, "Manager", name, email, password);
    }

    @Override
    public void run(ApplicationArguments args) {
        seed(admin);
        seed(manager);
    }

    private void seed(Seed seed) {
        if (seed.email().isBlank() || seed.password().isBlank() || users.anyWithRole(seed.role())) {
            return;
        }
        if (seed.password().length() < 8) {
            log.warn("The first {} password is shorter than 8 characters; skipping", seed.role());
            return;
        }
        if (users.findByEmail(UserService.normalizeEmail(seed.email())).isPresent()) {
            log.warn("Can't create the first {}: {} is already used by another account", seed.role(), seed.email());
            return;
        }
        userService.create(seed.name(), seed.email(), seed.password(), null, seed.position(), seed.role());
        log.info("Seeded {} account {}", seed.role(), seed.email());
    }
}
