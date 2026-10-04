package com.dailyupdate.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Makes sure the default workspace (company 1) exists. It holds everything from before workspaces
 * existed and the first admin from ADMIN_*, at {@code <DEFAULT_WORKSPACE>.<root domain>}.
 */
@Component
@Order(0)
public class WorkspaceSeeder implements ApplicationRunner {

    private final CompanyRepository companies;
    private final String slug;
    private final String name;

    public WorkspaceSeeder(CompanyRepository companies,
            @Value("${app.default-workspace.slug}") String slug,
            @Value("${app.default-workspace.name}") String name) {
        this.companies = companies;
        this.slug = slug.trim().toLowerCase();
        this.name = name.trim();
    }

    @Override
    public void run(ApplicationArguments args) {
        companies.ensureDefault(slug, name);
    }
}
