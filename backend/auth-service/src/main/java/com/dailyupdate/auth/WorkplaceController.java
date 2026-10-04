package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Work calendar settings. Everyone signed in can read them; only admins change them (the
 * {@code /api/admin/**} rule in {@link SecurityConfig}).
 */
@RestController
public class WorkplaceController {

    private final WorkplaceRepository workplace;

    public WorkplaceController(WorkplaceRepository workplace) {
        this.workplace = workplace;
    }

    /** The feature flags, the offices, and holidays from last year to next year. */
    @GetMapping("/api/workplace")
    public Map<String, Object> get() {
        int year = LocalDate.now(ZoneOffset.UTC).getYear();
        var body = new LinkedHashMap<String, Object>();
        body.put("weekendRequests", weekendRequests());
        body.put("offices", Workplace.OFFICES);
        body.put("holidays", workplace.holidays(LocalDate.of(year - 1, 1, 1), LocalDate.of(year + 1, 12, 31)));
        return body;
    }

    @PutMapping("/api/admin/settings")
    public Map<String, Object> saveSettings(@RequestBody Requests.Settings body) {
        if (body.weekendRequests() != null) {
            workplace.saveSetting(Workplace.WEEKEND_REQUESTS, body.weekendRequests().toString());
        }
        return Map.of("weekendRequests", weekendRequests());
    }

    @PostMapping("/api/admin/holidays")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addHoliday(@Valid @RequestBody Requests.Holiday body) {
        try {
            return Map.of("holiday", workplace.insertHoliday(Workplace.office(body.city()), date(body.date()),
                    body.name().trim()));
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "That office already has a holiday on that day");
        }
    }

    @PatchMapping("/api/admin/holidays/{id}")
    public Map<String, Object> updateHoliday(@PathVariable long id, @Valid @RequestBody Requests.Holiday body) {
        workplace.holiday(id).orElseThrow(() -> new ApiException(404, "Holiday not found"));
        try {
            return Map.of("holiday", workplace.updateHoliday(id, Workplace.office(body.city()), date(body.date()),
                    body.name().trim()));
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "That office already has a holiday on that day");
        }
    }

    @DeleteMapping("/api/admin/holidays/{id}")
    public ResponseEntity<Void> deleteHoliday(@PathVariable long id) {
        if (!workplace.deleteHoliday(id)) {
            throw new ApiException(404, "Holiday not found");
        }
        return ResponseEntity.noContent().build();
    }

    private boolean weekendRequests() {
        return workplace.setting(Workplace.WEEKEND_REQUESTS).map(Boolean::parseBoolean).orElse(false);
    }

    private static LocalDate date(String value) {
        try {
            LocalDate day = LocalDate.parse(value);
            if (day.getYear() < 2000 || day.getYear() > 2100) {
                throw new ApiException(400, "Pick a date between 2000 and 2100");
            }
            return day;
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "Date must look like 2026-12-25");
        }
    }
}
