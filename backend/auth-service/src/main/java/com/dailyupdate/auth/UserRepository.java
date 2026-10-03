package com.dailyupdate.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private static final String COLUMNS = "id, name, email, password_hash, role, team, position";

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<User> findByEmail(String email) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE email = :email")
                .param("email", email)
                .query(User.class)
                .optional();
    }

    public Optional<User> findById(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE id = :id")
                .param("id", id)
                .query(User.class)
                .optional();
    }

    public List<User> findEmployees() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE role = 'employee' ORDER BY name")
                .query(User.class)
                .list();
    }

    public List<User> findAll() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users ORDER BY role DESC, name")
                .query(User.class)
                .list();
    }

    public List<User> findManagers() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE role = 'manager' ORDER BY name")
                .query(User.class)
                .list();
    }

    public User update(long id, String team, String position, String role) {
        return jdbc.sql("UPDATE users SET team = :team, position = :position, role = :role WHERE id = :id RETURNING "
                        + COLUMNS)
                .param("id", id)
                .param("team", team)
                .param("position", position)
                .param("role", role)
                .query(User.class)
                .single();
    }

    public boolean anyManager() {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'manager')")
                .query(Boolean.class)
                .single();
    }

    public User insert(String name, String email, String passwordHash, String role, String team, String position) {
        return jdbc.sql("""
                        INSERT INTO users (name, email, password_hash, role, team, position)
                        VALUES (:name, :email, :hash, :role, :team, :position)
                        RETURNING """ + " " + COLUMNS)
                .param("name", name)
                .param("email", email)
                .param("hash", passwordHash)
                .param("role", role)
                .param("team", team)
                .param("position", position)
                .query(User.class)
                .single();
    }
}
