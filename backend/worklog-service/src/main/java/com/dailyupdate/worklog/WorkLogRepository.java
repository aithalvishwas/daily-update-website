package com.dailyupdate.worklog;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class WorkLogRepository {

    private static final String COLUMNS = "id, user_id, user_name, work_date, tasks, hours, blockers, updated_at";

    public record Overview(long userId, LocalDate lastLogDate, int logsLast7Days) {}

    private final JdbcClient jdbc;

    public WorkLogRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** One entry per user per day: saving again for the same date replaces it. */
    public WorkLog upsert(long userId, String userName, LocalDate date, String tasks, BigDecimal hours, String blockers) {
        return jdbc.sql("""
                        INSERT INTO work_logs (user_id, user_name, work_date, tasks, hours, blockers)
                        VALUES (:userId, :userName, :date, :tasks, :hours, :blockers)
                        ON CONFLICT (user_id, work_date)
                        DO UPDATE SET tasks = EXCLUDED.tasks, hours = EXCLUDED.hours,
                                      blockers = EXCLUDED.blockers, user_name = EXCLUDED.user_name,
                                      updated_at = now()
                        RETURNING """ + " " + COLUMNS)
                .param("userId", userId)
                .param("userName", userName)
                .param("date", date)
                .param("tasks", tasks)
                .param("hours", hours)
                .param("blockers", blockers)
                .query(WorkLog.class)
                .single();
    }

    public List<WorkLog> findForUser(long userId, LocalDate from, LocalDate to) {
        return jdbc.sql("SELECT " + COLUMNS + """
                         FROM work_logs
                        WHERE user_id = :userId AND work_date BETWEEN :from AND :to
                        ORDER BY work_date DESC""")
                .param("userId", userId)
                .param("from", from)
                .param("to", to)
                .query(WorkLog.class)
                .list();
    }

    /** Deletes only when the log belongs to the user. */
    public boolean deleteOwn(long id, long userId) {
        return jdbc.sql("DELETE FROM work_logs WHERE id = :id AND user_id = :userId")
                .param("id", id)
                .param("userId", userId)
                .update() > 0;
    }

    public List<Overview> overview() {
        return jdbc.sql("""
                        SELECT user_id,
                               MAX(work_date) AS last_log_date,
                               CAST(COUNT(*) FILTER (WHERE work_date >= CURRENT_DATE - 6) AS int) AS logs_last7_days
                        FROM work_logs GROUP BY user_id""")
                .query(Overview.class)
                .list();
    }
}
