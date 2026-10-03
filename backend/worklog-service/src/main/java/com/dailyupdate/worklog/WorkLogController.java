package com.dailyupdate.worklog;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/logs")
public class WorkLogController {

    private static final int MAX_TEXT = 5000;

    public record SaveRequest(String workDate, String tasks, BigDecimal hours, String blockers, Long epicId,
            List<Long> attachmentIds) {}

    private final WorkLogRepository logs;
    private final ProjectClient projects;

    public WorkLogController(WorkLogRepository logs, ProjectClient projects) {
        this.logs = logs;
        this.projects = projects;
    }

    /** Create or update the caller's log for a day. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> save(@RequestBody SaveRequest body, @RequestHeader("Authorization") String auth) {
        AuthUser user = SecuritySupport.currentUser();
        LocalDate date = body.workDate() == null || body.workDate().isBlank()
                ? today()
                : parseDate(body.workDate(), "workDate must be YYYY-MM-DD");
        // One day ahead of UTC so people east of UTC can log their local "today".
        if (date.isAfter(today().plusDays(1))) {
            throw new ApiException(400, "Cannot log work for a future date");
        }
        String tasks = body.tasks() == null ? "" : body.tasks().strip();
        if (tasks.isEmpty() || tasks.length() > MAX_TEXT) {
            throw new ApiException(400, "Describe your work (1 to " + MAX_TEXT + " characters)");
        }
        String blockers = body.blockers() == null ? "" : body.blockers().strip();
        if (blockers.length() > MAX_TEXT) {
            throw new ApiException(400, "Blockers text is too long");
        }
        BigDecimal hours = body.hours();
        if (hours != null && (hours.signum() < 0 || hours.compareTo(BigDecimal.valueOf(24)) > 0)) {
            throw new ApiException(400, "Hours must be between 0 and 24");
        }
        ProjectClient.EpicRef epic = null;
        if (body.epicId() != null) {
            epic = projects.epic(body.epicId(), auth)
                    .orElseThrow(() -> new ApiException(400, "You are not on that epic"));
        }
        List<Long> attachmentIds = body.attachmentIds() == null ? List.of()
                : body.attachmentIds().stream().filter(Objects::nonNull).distinct().limit(10).toList();
        String previousBlockers = logs.findOwn(user.id(), date).map(WorkLog::blockers).orElse(null);
        WorkLog saved = logs.upsert(user.id(), user.name(), date, tasks, hours, blockers.isEmpty() ? null : blockers,
                epic == null ? null : epic.id(), epic == null ? null : epic.name(), attachmentIds);
        // A new or changed blocker becomes an alert for the managers.
        if (!blockers.isEmpty() && !blockers.equals(previousBlockers)) {
            projects.raiseBlocker(blockers, saved.epicId(), auth);
        }
        return Map.of("log", saved);
    }

    @GetMapping("/me")
    public Map<String, List<WorkLog>> mine(@RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        LocalDate[] range = range(from, to);
        return Map.of("logs", logs.findForUser(SecuritySupport.currentUser().id(), range[0], range[1]));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        if (!logs.deleteOwn(id, SecuritySupport.currentUser().id())) {
            throw new ApiException(404, "Log not found");
        }
        return ResponseEntity.noContent().build();
    }

    /** Managers: last log date and entries in the last 7 days, per employee. */
    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return Map.of("overview", logs.overview());
    }

    /** Managers: any employee's logs. */
    @GetMapping("/user/{userId}")
    public Map<String, List<WorkLog>> forUser(@PathVariable long userId,
            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        LocalDate[] range = range(from, to);
        return Map.of("logs", logs.findForUser(userId, range[0], range[1]));
    }

    /** Managers: daily updates linked to an epic. */
    @GetMapping("/epic/{epicId}")
    public Map<String, List<WorkLog>> forEpic(@PathVariable long epicId,
            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        LocalDate[] range = range(from, to);
        return Map.of("logs", logs.findForEpic(epicId, range[0], range[1]));
    }

    /** Reads ?from=&to= with a default window of the last 30 days. */
    private static LocalDate[] range(String from, String to) {
        LocalDate end = to == null ? today() : parseDate(to, "from/to must be YYYY-MM-DD");
        LocalDate start = from == null ? today().minusDays(30) : parseDate(from, "from/to must be YYYY-MM-DD");
        if (start.isAfter(end)) {
            throw new ApiException(400, "from must be on or before to");
        }
        return new LocalDate[] {start, end};
    }

    private static LocalDate parseDate(String value, String error) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new ApiException(400, error);
        }
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }
}
