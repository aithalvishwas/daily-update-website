package com.dailyupdate.project;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class MilestoneRepository {

    public record Milestone(long id, long epicId, String name, LocalDate dueDate, boolean done) {}

    private static final String SELECT = "SELECT id, epic_id, name, due_date, done FROM milestones";

    private final JdbcClient jdbc;

    public MilestoneRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Milestone> findForEpic(long epicId) {
        return jdbc.sql(SELECT + " WHERE epic_id = :epicId ORDER BY due_date, id")
                .param("epicId", epicId)
                .query(Milestone.class)
                .list();
    }

    public Optional<Milestone> findById(long id) {
        return jdbc.sql(SELECT + " WHERE id = :id").param("id", id).query(Milestone.class).optional();
    }

    public Milestone insert(long epicId, String name, LocalDate dueDate) {
        return jdbc.sql("""
                        INSERT INTO milestones (epic_id, name, due_date) VALUES (:epicId, :name, :dueDate)
                        RETURNING id, epic_id, name, due_date, done""")
                .param("epicId", epicId)
                .param("name", name)
                .param("dueDate", dueDate)
                .query(Milestone.class)
                .single();
    }

    public Milestone update(long id, String name, LocalDate dueDate, boolean done) {
        return jdbc.sql("""
                        UPDATE milestones SET name = :name, due_date = :dueDate, done = :done WHERE id = :id
                        RETURNING id, epic_id, name, due_date, done""")
                .param("id", id)
                .param("name", name)
                .param("dueDate", dueDate)
                .param("done", done)
                .query(Milestone.class)
                .single();
    }

    public boolean delete(long id) {
        return jdbc.sql("DELETE FROM milestones WHERE id = :id").param("id", id).update() > 0;
    }
}
