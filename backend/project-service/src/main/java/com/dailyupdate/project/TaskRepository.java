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
public class TaskRepository {

    public record Task(long id, long epicId, String epicName, String title, String description, String status,
            String priority, Long assigneeId, String assigneeName, LocalDate dueDate, BigDecimal estimateHours,
            long createdBy, String createdByName, int commentCount, OffsetDateTime createdAt,
            OffsetDateTime updatedAt, OffsetDateTime completedAt) {}

    public record Comment(long id, long authorId, String authorName, String body, OffsetDateTime createdAt) {}

    /** Open work per person, for the workload view. */
    public record Load(long assigneeId, String assigneeName, int open, int inProgress, int overdue, int dueThisWeek,
            int doneLast7Days, BigDecimal openEstimateHours) {}

    private static final String SELECT = """
            SELECT t.id, t.epic_id, e.name AS epic_name, t.title, t.description, t.status, t.priority,
                   t.assignee_id, t.assignee_name, t.due_date, t.estimate_hours, t.created_by, t.created_by_name,
                   CAST((SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) AS int) AS comment_count,
                   t.created_at, t.updated_at, t.completed_at
            FROM tasks t JOIN epics e ON e.id = t.epic_id""";

    private static final String ORDER = " " + """
            ORDER BY t.status = 'done', t.due_date IS NULL, t.due_date,
                     CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.id""";

    private final JdbcClient jdbc;

    public TaskRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Task> findForEpic(long epicId) {
        return jdbc.sql(SELECT + " WHERE t.epic_id = :epicId" + ORDER)
                .param("epicId", epicId)
                .query(Task.class)
                .list();
    }

    /** A person's tasks; finished ones only from the last 14 days so the list stays short. */
    public List<Task> findForAssignee(long userId) {
        return jdbc.sql(SELECT + " " + """
                        WHERE t.assignee_id = :userId
                          AND (t.status <> 'done' OR t.completed_at >= now() - INTERVAL '14 days')""" + ORDER)
                .param("userId", userId)
                .query(Task.class)
                .list();
    }

    public Optional<Task> findById(long id) {
        return jdbc.sql(SELECT + " WHERE t.id = :id").param("id", id).query(Task.class).optional();
    }

    public long insert(long epicId, String title, String description, String status, String priority,
            Long assigneeId, String assigneeName, LocalDate dueDate, BigDecimal estimateHours, long createdBy,
            String createdByName) {
        return jdbc.sql("""
                        INSERT INTO tasks (epic_id, title, description, status, priority, assignee_id, assignee_name,
                                           due_date, estimate_hours, created_by, created_by_name, completed_at)
                        VALUES (:epicId, :title, :description, :status, :priority, :assigneeId, :assigneeName,
                                :dueDate, :estimate, :createdBy, :createdByName,
                                CASE WHEN :status = 'done' THEN now() END)
                        RETURNING id""")
                .param("epicId", epicId)
                .param("title", title)
                .param("description", description, Types.VARCHAR)
                .param("status", status)
                .param("priority", priority)
                .param("assigneeId", assigneeId, Types.BIGINT)
                .param("assigneeName", assigneeName, Types.VARCHAR)
                .param("dueDate", dueDate, Types.DATE)
                .param("estimate", estimateHours, Types.NUMERIC)
                .param("createdBy", createdBy)
                .param("createdByName", createdByName)
                .query(Long.class)
                .single();
    }

    public void update(long id, String title, String description, String status, String priority, Long assigneeId,
            String assigneeName, LocalDate dueDate, BigDecimal estimateHours) {
        jdbc.sql("""
                        UPDATE tasks SET title = :title, description = :description, priority = :priority,
                               assignee_id = :assigneeId, assignee_name = :assigneeName, due_date = :dueDate,
                               estimate_hours = :estimate,
                               completed_at = CASE WHEN :status <> 'done' THEN NULL
                                                   WHEN status = 'done' THEN completed_at ELSE now() END,
                               status = :status, updated_at = now()
                        WHERE id = :id""")
                .param("id", id)
                .param("title", title)
                .param("description", description, Types.VARCHAR)
                .param("status", status)
                .param("priority", priority)
                .param("assigneeId", assigneeId, Types.BIGINT)
                .param("assigneeName", assigneeName, Types.VARCHAR)
                .param("dueDate", dueDate, Types.DATE)
                .param("estimate", estimateHours, Types.NUMERIC)
                .update();
    }

    public boolean delete(long id) {
        return jdbc.sql("DELETE FROM tasks WHERE id = :id").param("id", id).update() > 0;
    }

    public List<Comment> comments(long taskId) {
        return jdbc.sql("""
                        SELECT id, author_id, author_name, body, created_at FROM task_comments
                        WHERE task_id = :taskId ORDER BY created_at, id""")
                .param("taskId", taskId)
                .query(Comment.class)
                .list();
    }

    public Comment addComment(long taskId, long authorId, String authorName, String body) {
        return jdbc.sql("""
                        INSERT INTO task_comments (task_id, author_id, author_name, body)
                        VALUES (:taskId, :authorId, :authorName, :body)
                        RETURNING id, author_id, author_name, body, created_at""")
                .param("taskId", taskId)
                .param("authorId", authorId)
                .param("authorName", authorName)
                .param("body", body)
                .query(Comment.class)
                .single();
    }

    /** Everyone who has tasks: open, in progress, overdue, due in the next 7 days, finished in the last 7. */
    public List<Load> workload(LocalDate today) {
        return jdbc.sql("""
                        SELECT assignee_id, MAX(assignee_name) AS assignee_name,
                               CAST(COUNT(*) FILTER (WHERE status <> 'done') AS int) AS open,
                               CAST(COUNT(*) FILTER (WHERE status IN ('in_progress', 'review')) AS int) AS in_progress,
                               CAST(COUNT(*) FILTER (WHERE status <> 'done' AND due_date < :today) AS int) AS overdue,
                               CAST(COUNT(*) FILTER (WHERE status <> 'done' AND due_date BETWEEN :today AND :weekEnd)
                                    AS int) AS due_this_week,
                               CAST(COUNT(*) FILTER (WHERE status = 'done' AND completed_at >= now() - INTERVAL '7 days')
                                    AS int) AS done_last7_days,
                               COALESCE(SUM(estimate_hours) FILTER (WHERE status <> 'done'), 0) AS open_estimate_hours
                        FROM tasks WHERE assignee_id IS NOT NULL
                        GROUP BY assignee_id ORDER BY MAX(assignee_name)""")
                .param("today", today)
                .param("weekEnd", today.plusDays(6))
                .query(Load.class)
                .list();
    }
}
