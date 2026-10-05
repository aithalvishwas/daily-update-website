package com.dailyupdate.auth;

import java.sql.Types;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private static final String COLUMNS = "id, name, email, password_hash, role, team, position, office, active, invite_pending";

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
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE role = 'employee' AND active ORDER BY name")
                .query(User.class)
                .list();
    }

    public List<User> findAll() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE active ORDER BY role DESC, name")
                .query(User.class)
                .list();
    }

    /** Admins: everyone, including deactivated accounts. */
    public List<User> findEveryone() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users ORDER BY active DESC, name")
                .query(User.class)
                .list();
    }

    public List<User> findManagers() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE role = 'manager' AND active ORDER BY name")
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

    public boolean anyWithRole(String role) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM users WHERE role = :role)")
                .param("role", role)
                .query(Boolean.class)
                .single();
    }

    public int activeAdmins() {
        return jdbc.sql("SELECT CAST(COUNT(*) AS int) FROM users WHERE role = 'admin' AND active")
                .query(Integer.class)
                .single();
    }

    public User updateAccount(long id, String name, String email, String team, String position, String office,
            String role) {
        return jdbc.sql("""
                        UPDATE users SET name = :name, email = :email, team = :team, position = :position,
                            office = :office, role = :role
                        WHERE id = :id RETURNING """ + " " + COLUMNS)
                .param("office", office, Types.VARCHAR)
                .param("id", id)
                .param("name", name)
                .param("email", email)
                .param("team", team)
                .param("position", position)
                .param("role", role)
                .query(User.class)
                .single();
    }

    public User setOffice(long id, String office) {
        return jdbc.sql("UPDATE users SET office = :office WHERE id = :id RETURNING " + COLUMNS)
                .param("id", id)
                .param("office", office, Types.VARCHAR)
                .query(User.class)
                .single();
    }

    /** Setting a password also ends a pending invite. */
    public void setPassword(long id, String passwordHash) {
        jdbc.sql("UPDATE users SET password_hash = :hash, invite_pending = false WHERE id = :id")
                .param("id", id)
                .param("hash", passwordHash)
                .update();
    }

    public void markInvited(long id) {
        jdbc.sql("UPDATE users SET invite_pending = true WHERE id = :id").param("id", id).update();
    }

    public User setActive(long id, boolean active) {
        return jdbc.sql("UPDATE users SET active = :active WHERE id = :id RETURNING " + COLUMNS)
                .param("id", id)
                .param("active", active)
                .query(User.class)
                .single();
    }

    public User insert(String name, String email, String passwordHash, String role, String team, String position,
            String office) {
        return jdbc.sql("""
                        INSERT INTO users (name, email, password_hash, role, team, position, office)
                        VALUES (:name, :email, :hash, :role, :team, :position, :office)
                        RETURNING """ + " " + COLUMNS)
                .param("office", office, Types.VARCHAR)
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
