package com.dailyupdate.worklog;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record WorkLog(
        long id,
        long userId,
        String userName,
        LocalDate workDate,
        String tasks,
        BigDecimal hours,
        String blockers,
        OffsetDateTime updatedAt) {}
