package com.dailyupdate.project;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationRepository {

    public record Notification(long id, String type, String title, String body, String link,
            OffsetDateTime readAt, OffsetDateTime createdAt) {}

    private final JdbcClient jdbc;

    public NotificationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(long userId, String type, String title, String body, String link) {
        jdbc.sql("""
                        INSERT INTO notifications (user_id, type, title, body, link)
                        VALUES (:userId, :type, :title, :body, :link)""")
                .param("userId", userId)
                .param("type", type)
                .param("title", title)
                .param("body", body)
                .param("link", link)
                .update();
    }

    public List<Notification> latest(long userId) {
        return jdbc.sql("""
                        SELECT id, type, title, body, link, read_at, created_at FROM notifications
                        WHERE user_id = :userId ORDER BY created_at DESC LIMIT 50""")
                .param("userId", userId)
                .query(Notification.class)
                .list();
    }

    public int unreadCount(long userId) {
        return jdbc.sql("SELECT CAST(COUNT(*) AS int) FROM notifications WHERE user_id = :userId AND read_at IS NULL")
                .param("userId", userId)
                .query(Integer.class)
                .single();
    }

    /** Marks one notification read, or all of them when {@code id} is null. */
    public void markRead(long userId, Long id) {
        jdbc.sql("""
                        UPDATE notifications SET read_at = now()
                        WHERE user_id = :userId AND read_at IS NULL AND (CAST(:id AS bigint) IS NULL OR id = :id)""")
                .param("userId", userId)
                .param("id", id, Types.BIGINT)
                .update();
    }
}
