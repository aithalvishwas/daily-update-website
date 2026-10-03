package com.dailyupdate.project;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/epics")
public class EpicController {

    private static final Set<String> STATUSES = Set.of("planned", "in_progress", "done");

    public record EpicRequest(String name, String description, String team, String startDate, String dueDate,
            String status, Integer progress, List<Long> memberIds) {}

    public record ProgressRequest(Integer progress, String status) {}

    private final EpicRepository epics;
    private final AuthClient authClient;
    private final Notifier notifier;

    public EpicController(EpicRepository epics, AuthClient authClient, Notifier notifier) {
        this.epics = epics;
        this.authClient = authClient;
        this.notifier = notifier;
    }

    /** Managers see every epic; employees see the ones they are on. */
    @GetMapping
    public Map<String, List<Epic>> list() {
        AuthUser me = SecuritySupport.currentUser();
        return Map.of("epics", me.isManager() ? epics.findAll() : epics.findForMember(me.id()));
    }

    @GetMapping("/{id}")
    public Map<String, Epic> one(@PathVariable long id) {
        return Map.of("epic", visible(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Epic> create(@RequestBody EpicRequest body, @RequestHeader("Authorization") String auth) {
        AuthUser me = SecuritySupport.requireManager();
        String name = requireText(body.name(), "Epic name is required", 150);
        LocalDate start = body.startDate() == null ? LocalDate.now() : date(body.startDate());
        LocalDate due = date(body.dueDate());
        checkDates(start, due);
        List<Epic.Member> members = members(body.memberIds(), auth);
        long id = epics.insert(name, optionalText(body.description(), 5000), optionalText(body.team(), 100),
                start, due, me.id(), members);
        for (Epic.Member m : members) {
            notifier.user(m.userId(), "epic_assigned", "You were added to the epic \"" + name + "\"",
                    "Due " + due + ".", "/epics/" + id);
        }
        return Map.of("epic", epics.findById(id).orElseThrow());
    }

    /** Managers: edit any field. Members not listed are removed; new ones are notified. */
    @PutMapping("/{id}")
    public Map<String, Epic> update(@PathVariable long id, @RequestBody EpicRequest body,
            @RequestHeader("Authorization") String auth) {
        SecuritySupport.requireManager();
        Epic current = epics.findById(id).orElseThrow(() -> new ApiException(404, "Epic not found"));
        String name = body.name() == null ? current.name() : requireText(body.name(), "Epic name is required", 150);
        LocalDate start = body.startDate() == null ? current.startDate() : date(body.startDate());
        LocalDate due = body.dueDate() == null ? current.dueDate() : date(body.dueDate());
        checkDates(start, due);
        String status = body.status() == null ? current.status() : status(body.status());
        int progress = body.progress() == null ? current.progress() : progress(body.progress());
        List<Epic.Member> members = body.memberIds() == null ? null : members(body.memberIds(), auth);
        epics.update(id, name,
                body.description() == null ? current.description() : optionalText(body.description(), 5000),
                body.team() == null ? current.team() : optionalText(body.team(), 100),
                start, due, status, progress, members);
        if (members != null) {
            for (Epic.Member m : members) {
                if (!current.hasMember(m.userId())) {
                    notifier.user(m.userId(), "epic_assigned", "You were added to the epic \"" + name + "\"",
                            "Due " + due + ".", "/epics/" + id);
                }
            }
        }
        return Map.of("epic", epics.findById(id).orElseThrow());
    }

    /** Members and managers: move progress and status forward. */
    @PatchMapping("/{id}/progress")
    public Map<String, Epic> progress(@PathVariable long id, @RequestBody ProgressRequest body,
            @RequestHeader("Authorization") String auth) {
        AuthUser me = SecuritySupport.currentUser();
        Epic epic = visible(id);
        int progress = body.progress() == null ? epic.progress() : progress(body.progress());
        String status = body.status() == null
                ? (progress >= 100 ? "done" : progress > 0 && "planned".equals(epic.status()) ? "in_progress" : epic.status())
                : status(body.status());
        epics.updateProgress(id, status, progress);
        if (!me.isManager() && "done".equals(status) && !"done".equals(epic.status())) {
            notifier.managers(auth, me.id(), "epic_done", me.name() + " marked \"" + epic.name() + "\" as done",
                    null, "/epics/" + id);
        }
        return Map.of("epic", epics.findById(id).orElseThrow());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        SecuritySupport.requireManager();
        if (!epics.delete(id)) {
            throw new ApiException(404, "Epic not found");
        }
        return ResponseEntity.noContent().build();
    }

    private Epic visible(long id) {
        AuthUser me = SecuritySupport.currentUser();
        Epic epic = epics.findById(id).orElseThrow(() -> new ApiException(404, "Epic not found"));
        if (!me.isManager() && !epic.hasMember(me.id())) {
            throw new ApiException(404, "Epic not found");
        }
        return epic;
    }

    private List<Epic.Member> members(List<Long> ids, String auth) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        var people = authClient.everyone(auth);
        return new LinkedHashSet<>(ids).stream()
                .map(id -> {
                    var person = people.get(id);
                    if (person == null) {
                        throw new ApiException(400, "Unknown team member " + id);
                    }
                    return new Epic.Member(person.id(), person.name());
                })
                .toList();
    }

    static String requireText(String value, String error, int max) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, error);
        }
        if (value.strip().length() > max) {
            throw new ApiException(400, "Text is too long (max " + max + " characters)");
        }
        return value.strip();
    }

    static String optionalText(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.strip().length() > max) {
            throw new ApiException(400, "Text is too long (max " + max + " characters)");
        }
        return value.strip();
    }

    static LocalDate date(String value) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, "A deadline is required");
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "Dates must be YYYY-MM-DD");
        }
    }

    private static void checkDates(LocalDate start, LocalDate due) {
        if (due.isBefore(start)) {
            throw new ApiException(400, "The deadline must be on or after the start date");
        }
    }

    private static String status(String value) {
        if (!STATUSES.contains(value)) {
            throw new ApiException(400, "Status must be planned, in_progress or done");
        }
        return value;
    }

    private static int progress(int value) {
        if (value < 0 || value > 100) {
            throw new ApiException(400, "Progress must be between 0 and 100");
        }
        return value;
    }
}
