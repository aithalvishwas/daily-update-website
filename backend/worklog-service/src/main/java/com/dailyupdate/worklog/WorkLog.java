package com.dailyupdate.worklog;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record WorkLog(
        long id,
        long userId,
        String userName,
        LocalDate workDate,
        String tasks,
        BigDecimal hours,
        String blockers,
        Long epicId,
        String epicName,
        List<Long> attachmentIds,
        OffsetDateTime updatedAt) {}
