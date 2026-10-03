package com.dailyupdate.project;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** An epic with its members and a computed health ("on track" and friends). */
public record Epic(
        long id,
        String name,
        String description,
        String team,
        LocalDate startDate,
        LocalDate dueDate,
        String status,
        int progress,
        List<Member> members,
        int openIssues,
        String health,
        int expectedProgress,
        long daysLeft,
        OffsetDateTime updatedAt) {

    public record Member(long userId, String userName) {}

    public record Row(long id, String name, String description, String team, LocalDate startDate,
            LocalDate dueDate, String status, int progress, int openIssues, OffsetDateTime updatedAt) {}

    public boolean hasMember(long userId) {
        return members.stream().anyMatch(m -> m.userId() == userId);
    }

    public static Epic of(Row row, List<Member> members) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long total = Math.max(1, ChronoUnit.DAYS.between(row.startDate(), row.dueDate()));
        long elapsed = ChronoUnit.DAYS.between(row.startDate(), today);
        int expected = (int) Math.max(0, Math.min(100, Math.round(elapsed * 100.0 / total)));
        long daysLeft = ChronoUnit.DAYS.between(today, row.dueDate());
        return new Epic(row.id(), row.name(), row.description(), row.team(), row.startDate(), row.dueDate(),
                row.status(), row.progress(), members, row.openIssues(),
                health(row, today, expected), expected, daysLeft, row.updatedAt());
    }

    /**
     * done: finished. overdue: past the due date and not finished.
     * at_risk: more than 15 points behind the time elapsed, or an open blocker or deadline issue.
     * on_track: everything else.
     */
    static String health(Row row, LocalDate today, int expected) {
        if ("done".equals(row.status()) || row.progress() >= 100) {
            return "done";
        }
        if (today.isAfter(row.dueDate())) {
            return "overdue";
        }
        if (row.openIssues() > 0 || row.progress() + 15 < expected) {
            return "at_risk";
        }
        return "on_track";
    }
}
