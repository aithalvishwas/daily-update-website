package com.dailyupdate.summary;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class SummaryRepository {

    public record Summary(long id, long userId, LocalDate periodFrom, LocalDate periodTo, int logCount,
            String summary, String source, String model, OffsetDateTime createdAt) {}

    private static final String COLUMNS =
            "id, user_id, period_from, period_to, log_count, summary, source, model, created_at";

    private final JdbcClient jdbc;

    public SummaryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Summary> latest(long userId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM summaries WHERE user_id = :userId ORDER BY created_at DESC LIMIT 1")
                .param("userId", userId)
                .query(Summary.class)
                .optional();
    }

    public Summary insert(long userId, LocalDate from, LocalDate to, int logCount, Summarizer.Result result,
            long generatedBy) {
        return jdbc.sql("""
                        INSERT INTO summaries
                          (user_id, period_from, period_to, log_count, summary, source, model, generated_by)
                        VALUES (:userId, :from, :to, :count, :summary, :source, :model, :by)
                        RETURNING """ + " " + COLUMNS)
                .param("userId", userId)
                .param("from", from)
                .param("to", to)
                .param("count", logCount)
                .param("summary", result.text())
                .param("source", result.source())
                .param("model", result.model())
                .param("by", generatedBy)
                .query(Summary.class)
                .single();
    }
}
