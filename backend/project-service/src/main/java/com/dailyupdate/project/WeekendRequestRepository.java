package com.dailyupdate.project;

import java.math.BigDecimal;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class WeekendRequestRepository {

    public record WeekendRequest(long id, long userId, String userName, LocalDate workDate, BigDecimal hours,
            String compensation, String reason, String status, String managerNote, String alternative,
            String decidedBy, OffsetDateTime decidedAt, OffsetDateTime createdAt) {}

    private static final String COLUMNS = """
            id, user_id, user_name, work_date, hours, compensation, reason, status, manager_note, alternative,
            decided_by, decided_at, created_at""";

    private final JdbcClient jdbc;

    public WeekendRequestRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Pending first, then newest. {@code userId} null means everyone's. */
    public List<WeekendRequest> find(Long userId) {
        return jdbc.sql("SELECT " + COLUMNS + """
                         FROM weekend_requests
                        WHERE CAST(:userId AS bigint) IS NULL OR user_id = :userId
                        ORDER BY status = 'pending' DESC, work_date DESC LIMIT 200""")
                .param("userId", userId, Types.BIGINT)
                .query(WeekendRequest.class)
                .list();
    }

    public Optional<WeekendRequest> findById(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM weekend_requests WHERE id = :id")
                .param("id", id).query(WeekendRequest.class).optional();
    }

    /**
     * Creates a request, or reopens one for the same day that was rejected or cancelled.
     * Returns empty when an active request already exists for that day.
     */
    public Optional<WeekendRequest> submit(long userId, String userName, LocalDate workDate, BigDecimal hours,
            String compensation, String reason) {
        return jdbc.sql("""
                        INSERT INTO weekend_requests (user_id, user_name, work_date, hours, compensation, reason)
                        VALUES (:userId, :userName, :workDate, :hours, :compensation, :reason)
                        ON CONFLICT (user_id, work_date) DO UPDATE SET
                            user_name = EXCLUDED.user_name, hours = EXCLUDED.hours,
                            compensation = EXCLUDED.compensation, reason = EXCLUDED.reason, status = 'pending',
                            manager_note = NULL, alternative = NULL, decided_by = NULL, decided_at = NULL,
                            created_at = now()
                        WHERE weekend_requests.status IN ('rejected', 'cancelled')
                        RETURNING """ + " " + COLUMNS)
                .param("userId", userId)
                .param("userName", userName)
                .param("workDate", workDate)
                .param("hours", hours)
                .param("compensation", compensation)
                .param("reason", reason)
                .query(WeekendRequest.class)
                .optional();
    }

    /** Only changes a request that is still in {@code fromStatus}; returns false otherwise. */
    public boolean decide(long id, String fromStatus, String status, String note, String alternative, String decidedBy) {
        return jdbc.sql("""
                        UPDATE weekend_requests SET status = :status, manager_note = :note, alternative = :alternative,
                               decided_by = :decidedBy, decided_at = now()
                        WHERE id = :id AND status = :fromStatus""")
                .param("id", id)
                .param("fromStatus", fromStatus)
                .param("status", status)
                .param("note", note)
                .param("alternative", alternative)
                .param("decidedBy", decidedBy)
                .update() == 1;
    }

    /** Owner actions: accept a suggested alternative, or cancel. Keeps the manager's note. */
    public boolean ownerSetStatus(long id, long userId, List<String> fromStatuses, String status) {
        return jdbc.sql("""
                        UPDATE weekend_requests SET status = :status
                        WHERE id = :id AND user_id = :userId AND status IN (:from)""")
                .param("id", id)
                .param("userId", userId)
                .param("from", fromStatuses)
                .param("status", status)
                .update() == 1;
    }
}
