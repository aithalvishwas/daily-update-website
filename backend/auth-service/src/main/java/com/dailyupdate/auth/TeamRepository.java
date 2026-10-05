package com.dailyupdate.auth;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class TeamRepository {

    public record Team(long id, String name, int memberCount) {}

    private final JdbcClient jdbc;

    public TeamRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Team> findAll() {
        return jdbc.sql("""
                        SELECT t.id, t.name, CAST(COUNT(u.id) AS int) AS member_count
                        FROM teams t LEFT JOIN users u ON u.team = t.name
                        GROUP BY t.id, t.name ORDER BY t.name""")
                .query(Team.class)
                .list();
    }

    /** Creates the team if it doesn't exist yet. */
    public void ensure(String name) {
        jdbc.sql("INSERT INTO teams (name) VALUES (:name) ON CONFLICT (company_id, name) DO NOTHING")
                .param("name", name)
                .update();
    }
}
