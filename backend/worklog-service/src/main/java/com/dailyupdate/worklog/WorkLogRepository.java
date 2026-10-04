package com.dailyupdate.worklog;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class WorkLogRepository {

    private static final String COLUMNS =
            "id, user_id, user_name, work_date, tasks, hours, blockers, epic_id, epic_name, attachment_ids, updated_at";

    private static final RowMapper<WorkLog> MAPPER = WorkLogRepository::map;

    public record Overview(long userId, LocalDate lastLogDate, int logsLast7Days) {}

    public record TimesheetEntry(long userId, String userName, LocalDate workDate, BigDecimal hours, Long epicId,
            String epicName) {}

    private final JdbcClient jdbc;

    public WorkLogRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** One entry per user per day: saving again for the same date replaces it. */
    public WorkLog upsert(long userId, String userName, LocalDate date, String tasks, BigDecimal hours, String blockers,
            Long epicId, String epicName, List<Long> attachmentIds) {
        return jdbc.sql("""
                        INSERT INTO work_logs (user_id, user_name, work_date, tasks, hours, blockers,
                                               epic_id, epic_name, attachment_ids)
                        VALUES (:userId, :userName, :date, :tasks, :hours, :blockers,
                                :epicId, :epicName, CAST(:attachments AS bigint[]))
                        ON CONFLICT (user_id, work_date)
                        DO UPDATE SET tasks = EXCLUDED.tasks, hours = EXCLUDED.hours,
                                      blockers = EXCLUDED.blockers, user_name = EXCLUDED.user_name,
                                      epic_id = EXCLUDED.epic_id, epic_name = EXCLUDED.epic_name,
                                      attachment_ids = EXCLUDED.attachment_ids, updated_at = now()
                        RETURNING """ + " " + COLUMNS)
                .param("userId", userId)
                .param("userName", userName)
                .param("date", date)
                .param("tasks", tasks)
                .param("hours", hours)
                .param("blockers", blockers)
                .param("epicId", epicId, Types.BIGINT)
                .param("epicName", epicName)
                .param("attachments", "{" + String.join(",", attachmentIds.stream().map(String::valueOf).toList()) + "}")
                .query(MAPPER)
                .single();
    }

    public Optional<WorkLog> findOwn(long userId, LocalDate date) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM work_logs WHERE user_id = :userId AND work_date = :date")
                .param("userId", userId)
                .param("date", date)
                .query(MAPPER)
                .optional();
    }

    public List<WorkLog> findForEpic(long epicId, LocalDate from, LocalDate to) {
        return jdbc.sql("SELECT " + COLUMNS + """
                         FROM work_logs
                        WHERE epic_id = :epicId AND work_date BETWEEN :from AND :to
                        ORDER BY work_date DESC, user_name""")
                .param("epicId", epicId)
                .param("from", from)
                .param("to", to)
                .query(MAPPER)
                .list();
    }

    public List<WorkLog> findForUser(long userId, LocalDate from, LocalDate to) {
        return jdbc.sql("SELECT " + COLUMNS + """
                         FROM work_logs
                        WHERE user_id = :userId AND work_date BETWEEN :from AND :to
                        ORDER BY work_date DESC""")
                .param("userId", userId)
                .param("from", from)
                .param("to", to)
                .query(MAPPER)
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

    public List<TimesheetEntry> timesheet(LocalDate from, LocalDate to) {
        return jdbc.sql("""
                        SELECT user_id, user_name, work_date, hours, epic_id, epic_name FROM work_logs
                        WHERE work_date BETWEEN :from AND :to ORDER BY user_name, work_date""")
                .param("from", from)
                .param("to", to)
                .query(TimesheetEntry.class)
                .list();
    }

    private static WorkLog map(ResultSet rs, int row) throws SQLException {
        Array array = rs.getArray("attachment_ids");
        List<Long> attachmentIds = array == null ? List.of() : Arrays.stream((Long[]) array.getArray()).toList();
        Long epicId = rs.getObject("epic_id", Long.class);
        return new WorkLog(rs.getLong("id"), rs.getLong("user_id"), rs.getString("user_name"),
                rs.getObject("work_date", LocalDate.class), rs.getString("tasks"), rs.getBigDecimal("hours"),
                rs.getString("blockers"), epicId, rs.getString("epic_name"), attachmentIds,
                rs.getObject("updated_at", OffsetDateTime.class));
    }
}
