package com.dailyupdate.project;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class EpicRepository {

    private static final String SELECT = """
            SELECT e.id, e.name, e.description, e.team, e.start_date, e.due_date, e.status, e.progress,
                   CAST((SELECT COUNT(*) FROM issues i WHERE i.epic_id = e.id AND i.status = 'open') AS int) AS open_issues,
                   e.updated_at
            FROM epics e""";

    private record MemberRow(long epicId, long userId, String userName) {}

    private final JdbcClient jdbc;

    public EpicRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Epic> findAll() {
        return withMembers(jdbc.sql(SELECT + " ORDER BY e.due_date, e.id").query(Epic.Row.class).list());
    }

    public List<Epic> findForMember(long userId) {
        return withMembers(jdbc.sql(SELECT + """
                         WHERE e.id IN (SELECT epic_id FROM epic_members WHERE user_id = :userId)
                        ORDER BY e.due_date, e.id""")
                .param("userId", userId)
                .query(Epic.Row.class)
                .list());
    }

    public Optional<Epic> findById(long id) {
        return jdbc.sql(SELECT + " WHERE e.id = :id").param("id", id).query(Epic.Row.class).optional()
                .map(row -> withMembers(List.of(row)).getFirst());
    }

    @Transactional
    public long insert(String name, String description, String team, LocalDate start, LocalDate due,
            long createdBy, Collection<Epic.Member> members) {
        long id = jdbc.sql("""
                        INSERT INTO epics (name, description, team, start_date, due_date, status, created_by)
                        VALUES (:name, :description, :team, :start, :due, 'planned', :createdBy) RETURNING id""")
                .param("name", name)
                .param("description", description)
                .param("team", team)
                .param("start", start)
                .param("due", due)
                .param("createdBy", createdBy)
                .query(Long.class)
                .single();
        replaceMembers(id, members);
        return id;
    }

    @Transactional
    public void update(long id, String name, String description, String team, LocalDate start, LocalDate due,
            String status, int progress, Collection<Epic.Member> members) {
        jdbc.sql("""
                        UPDATE epics SET name = :name, description = :description, team = :team,
                               start_date = :start, due_date = :due, status = :status, progress = :progress,
                               updated_at = now()
                        WHERE id = :id""")
                .param("id", id)
                .param("name", name)
                .param("description", description)
                .param("team", team)
                .param("start", start)
                .param("due", due)
                .param("status", status)
                .param("progress", progress)
                .update();
        if (members != null) {
            replaceMembers(id, members);
        }
    }

    public void updateProgress(long id, String status, int progress) {
        jdbc.sql("UPDATE epics SET status = :status, progress = :progress, updated_at = now() WHERE id = :id")
                .param("id", id)
                .param("status", status)
                .param("progress", progress)
                .update();
    }

    public boolean delete(long id) {
        return jdbc.sql("DELETE FROM epics WHERE id = :id").param("id", id).update() > 0;
    }

    private void replaceMembers(long epicId, Collection<Epic.Member> members) {
        jdbc.sql("DELETE FROM epic_members WHERE epic_id = :id").param("id", epicId).update();
        for (Epic.Member m : members) {
            jdbc.sql("INSERT INTO epic_members (epic_id, user_id, user_name) VALUES (:epicId, :userId, :userName)")
                    .param("epicId", epicId)
                    .param("userId", m.userId())
                    .param("userName", m.userName())
                    .update();
        }
    }

    private List<Epic> withMembers(List<Epic.Row> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<Long> ids = rows.stream().map(Epic.Row::id).toList();
        Map<Long, List<Epic.Member>> members = jdbc.sql("""
                        SELECT epic_id, user_id, user_name FROM epic_members
                        WHERE epic_id IN (:ids) ORDER BY user_name""")
                .param("ids", ids)
                .query(MemberRow.class)
                .list().stream()
                .collect(Collectors.groupingBy(MemberRow::epicId,
                        Collectors.mapping(m -> new Epic.Member(m.userId(), m.userName()), Collectors.toList())));
        return rows.stream().map(r -> Epic.of(r, members.getOrDefault(r.id(), List.of()))).toList();
    }
}
