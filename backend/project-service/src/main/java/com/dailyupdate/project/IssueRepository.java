package com.dailyupdate.project;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class IssueRepository {

    public record Issue(long id, String type, String title, String description, Long epicId, String epicName,
            long raisedBy, String raisedByName, String status, String source, int replyCount,
            OffsetDateTime lastReplyAt, OffsetDateTime createdAt, OffsetDateTime resolvedAt) {}

    public record Reply(long id, long authorId, String authorName, String authorRole, String body,
            OffsetDateTime createdAt) {}

    private static final String SELECT = """
            SELECT i.id, i.type, i.title, i.description, i.epic_id, e.name AS epic_name,
                   i.raised_by, i.raised_by_name, i.status, i.source,
                   CAST((SELECT COUNT(*) FROM issue_replies r WHERE r.issue_id = i.id) AS int) AS reply_count,
                   (SELECT MAX(r.created_at) FROM issue_replies r WHERE r.issue_id = i.id) AS last_reply_at,
                   i.created_at, i.resolved_at
            FROM issues i LEFT JOIN epics e ON e.id = i.epic_id""";

    private final JdbcClient jdbc;

    public IssueRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Open issues first, newest first. {@code raisedBy} null means everyone's. */
    public List<Issue> find(Long raisedBy, String status) {
        return jdbc.sql(SELECT + """
                         WHERE (CAST(:raisedBy AS bigint) IS NULL OR i.raised_by = :raisedBy)
                          AND (CAST(:status AS varchar) IS NULL OR i.status = :status)
                        ORDER BY i.status = 'open' DESC, i.created_at DESC LIMIT 200""")
                .param("raisedBy", raisedBy, Types.BIGINT)
                .param("status", status, Types.VARCHAR)
                .query(Issue.class)
                .list();
    }

    public Optional<Issue> findById(long id) {
        return jdbc.sql(SELECT + " WHERE i.id = :id").param("id", id).query(Issue.class).optional();
    }

    public long insert(String type, String title, String description, Long epicId, long raisedBy,
            String raisedByName, String source) {
        return jdbc.sql("""
                        INSERT INTO issues (type, title, description, epic_id, raised_by, raised_by_name, source)
                        VALUES (:type, :title, :description, :epicId, :raisedBy, :raisedByName, :source) RETURNING id""")
                .param("type", type)
                .param("title", title)
                .param("description", description)
                .param("epicId", epicId, Types.BIGINT)
                .param("raisedBy", raisedBy)
                .param("raisedByName", raisedByName)
                .param("source", source)
                .query(Long.class)
                .single();
    }

    public void setStatus(long id, String status) {
        jdbc.sql("""
                        UPDATE issues SET status = :status,
                               resolved_at = CASE WHEN :status = 'resolved' THEN now() ELSE NULL END
                        WHERE id = :id""")
                .param("id", id)
                .param("status", status)
                .update();
    }

    public List<Reply> replies(long issueId) {
        return jdbc.sql("""
                        SELECT id, author_id, author_name, author_role, body, created_at FROM issue_replies
                        WHERE issue_id = :id ORDER BY created_at, id""")
                .param("id", issueId)
                .query(Reply.class)
                .list();
    }

    public long addReply(long issueId, long authorId, String authorName, String authorRole, String body) {
        return jdbc.sql("""
                        INSERT INTO issue_replies (issue_id, author_id, author_name, author_role, body)
                        VALUES (:issueId, :authorId, :authorName, :authorRole, :body) RETURNING id""")
                .param("issueId", issueId)
                .param("authorId", authorId)
                .param("authorName", authorName)
                .param("authorRole", authorRole)
                .param("body", body)
                .query(Long.class)
                .single();
    }

    /** Who raised an issue, or -1 if it doesn't exist. */
    public long raisedBy(long issueId) {
        return jdbc.sql("SELECT raised_by FROM issues WHERE id = :id")
                .param("id", issueId).query(Long.class).optional().orElse(-1L);
    }

    /** Who raised the issue a reply belongs to, or -1. */
    public long raisedByForReply(long replyId) {
        return jdbc.sql("SELECT i.raised_by FROM issue_replies r JOIN issues i ON i.id = r.issue_id WHERE r.id = :id")
                .param("id", replyId).query(Long.class).optional().orElse(-1L);
    }

    public int openCount() {
        return jdbc.sql("SELECT CAST(COUNT(*) AS int) FROM issues WHERE status = 'open'").query(Integer.class).single();
    }
}
