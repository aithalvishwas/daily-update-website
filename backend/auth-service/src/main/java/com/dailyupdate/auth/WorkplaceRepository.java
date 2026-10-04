package com.dailyupdate.auth;

import java.sql.Types;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Feature flags and office holidays. */
@Repository
public class WorkplaceRepository {

    /** {@code city} is null when the holiday applies to every office. */
    public record Holiday(long id, String city, LocalDate date, String name) {}

    private static final String HOLIDAY_COLUMNS = "id, city, day AS date, name";

    private final JdbcClient jdbc;

    public WorkplaceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> setting(String key) {
        return jdbc.sql("SELECT value FROM app_settings WHERE key = :key").param("key", key).query(String.class)
                .optional();
    }

    public void saveSetting(String key, String value) {
        jdbc.sql("""
                        INSERT INTO app_settings (key, value) VALUES (:key, :value)
                        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""")
                .param("key", key)
                .param("value", value)
                .update();
    }

    /** Only adds the setting when it isn't there yet. Returns true if it was added. */
    public boolean addSettingIfMissing(String key, String value) {
        return jdbc.sql("INSERT INTO app_settings (key, value) VALUES (:key, :value) ON CONFLICT (key) DO NOTHING")
                .param("key", key)
                .param("value", value)
                .update() > 0;
    }

    public List<Holiday> holidays(LocalDate from, LocalDate to) {
        return jdbc.sql("SELECT " + HOLIDAY_COLUMNS + " FROM holidays WHERE day BETWEEN :from AND :to ORDER BY day, city NULLS FIRST")
                .param("from", from)
                .param("to", to)
                .query(Holiday.class)
                .list();
    }

    public Optional<Holiday> holiday(long id) {
        return jdbc.sql("SELECT " + HOLIDAY_COLUMNS + " FROM holidays WHERE id = :id").param("id", id)
                .query(Holiday.class).optional();
    }

    public Holiday insertHoliday(String city, LocalDate day, String name) {
        return jdbc.sql("INSERT INTO holidays (city, day, name) VALUES (:city, :day, :name) RETURNING " + HOLIDAY_COLUMNS)
                .param("city", city, Types.VARCHAR)
                .param("day", day)
                .param("name", name)
                .query(Holiday.class)
                .single();
    }

    /** Seeding: skips a holiday that already exists for that office and day. */
    public void insertHolidayIfMissing(String city, LocalDate day, String name) {
        jdbc.sql("INSERT INTO holidays (city, day, name) VALUES (:city, :day, :name) ON CONFLICT DO NOTHING")
                .param("city", city, Types.VARCHAR)
                .param("day", day)
                .param("name", name)
                .update();
    }

    public Holiday updateHoliday(long id, String city, LocalDate day, String name) {
        return jdbc.sql("UPDATE holidays SET city = :city, day = :day, name = :name WHERE id = :id RETURNING "
                        + HOLIDAY_COLUMNS)
                .param("id", id)
                .param("city", city, Types.VARCHAR)
                .param("day", day)
                .param("name", name)
                .query(Holiday.class)
                .single();
    }

    public boolean deleteHoliday(long id) {
        return jdbc.sql("DELETE FROM holidays WHERE id = :id").param("id", id).update() > 0;
    }
}
