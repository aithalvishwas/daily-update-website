package com.dailyupdate.auth;

import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class CompanyRepository {

    private final JdbcClient jdbc;

    public CompanyRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Company> findBySlug(String slug) {
        return jdbc.sql("SELECT id, slug, name FROM companies WHERE slug = :slug").param("slug", slug)
                .query(Company.class).optional();
    }

    public boolean slugTaken(String slug) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM companies WHERE slug = :slug)").param("slug", slug)
                .query(Boolean.class).single();
    }

    /** Reserves an id first, so the new workspace's rows can be written as that company. */
    public long nextId() {
        return jdbc.sql("SELECT nextval(pg_get_serial_sequence('companies', 'id'))").query(Long.class).single();
    }

    public Company insert(long id, String slug, String name) {
        return jdbc.sql("INSERT INTO companies (id, slug, name) VALUES (:id, :slug, :name) RETURNING id, slug, name")
                .param("id", id)
                .param("slug", slug)
                .param("name", name)
                .query(Company.class)
                .single();
    }

    /** Company 1 holds everything from before workspaces existed. */
    public void ensureDefault(String slug, String name) {
        jdbc.sql("INSERT INTO companies (id, slug, name) VALUES (1, :slug, :name) ON CONFLICT DO NOTHING")
                .param("slug", slug)
                .param("name", name)
                .update();
        jdbc.sql("SELECT setval(pg_get_serial_sequence('companies', 'id'), (SELECT MAX(id) FROM companies))")
                .query(Long.class).single();
    }
}
