package com.dailyupdate.project;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Tasks on an epic's board. Managers and the epic's people can add and move them. */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private static final Set<String> STATUSES = Set.of("todo", "in_progress", "review", "done");
    private static final Set<String> PRIORITIES = Set.of("low", "medium", "high", "urgent");
    private static final String STATUS_LABELS = "todo, in_progress, review or done";

    /** For updates, a field left out (null) stays as it is; {@code clearDueDate}/{@code unassign} clear it. */
    public record TaskRequest(Long epicId, String title, String description, String status, String priority,
            Long assigneeId, String dueDate, BigDecimal estimateHours, Boolean unassign, Boolean clearDueDate) {}

    public record CommentRequest(String body) {}

    private final TaskRepository tasks;
    private final EpicRepository epics;
    private final Notifier notifier;

    public TaskController(TaskRepository tasks, EpicRepository epics, Notifier notifier) {
        this.tasks = tasks;
        this.epics = epics;
        this.notifier = notifier;
    }

    @GetMapping
    public Map<String, List<TaskRepository.Task>> forEpic(@RequestParam long epicId) {
        visibleEpic(epicId);
        return Map.of("tasks", tasks.findForEpic(epicId));
    }

    @GetMapping("/mine")
    public Map<String, List<TaskRepository.Task>> mine() {
        return Map.of("tasks", tasks.findForAssignee(SecuritySupport.currentUser().id()));
    }

    /** Managers: one person's tasks. */
    @GetMapping("/assignee/{userId}")
    public Map<String, List<TaskRepository.Task>> forAssignee(@PathVariable long userId) {
        SecuritySupport.requireManager();
        return Map.of("tasks", tasks.findForAssignee(userId));
    }

    /** Managers: open, overdue and finished tasks per person. */
    @GetMapping("/workload")
    public Map<String, List<TaskRepository.Load>> workload() {
        SecuritySupport.requireManager();
        return Map.of("workload", tasks.workload(LocalDate.now(ZoneOffset.UTC)));
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable long id) {
        TaskRepository.Task task = visibleTask(id);
        return Map.of("task", task, "comments", tasks.comments(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, TaskRepository.Task> create(@RequestBody TaskRequest body) {
        AuthUser me = SecuritySupport.currentUser();
        if (body.epicId() == null) {
            throw new ApiException(400, "Pick the epic this task belongs to");
        }
        Epic epic = visibleEpic(body.epicId());
        String title = EpicController.requireText(body.title(), "Give the task a title", 200);
        Epic.Member assignee = assignee(epic, body.assigneeId());
        long id = tasks.insert(epic.id(), title, EpicController.optionalText(body.description(), 5000),
                body.status() == null ? "todo" : status(body.status()),
                body.priority() == null ? "medium" : priority(body.priority()),
                assignee == null ? null : assignee.userId(), assignee == null ? null : assignee.userName(),
                body.dueDate() == null || body.dueDate().isBlank() ? null : EpicController.date(body.dueDate()),
                estimate(body.estimateHours()), me.id(), me.name());
        if (assignee != null && assignee.userId() != me.id()) {
            notifyAssigned(assignee.userId(), me, title, epic, id);
        }
        return Map.of("task", tasks.findById(id).orElseThrow());
    }

    @PatchMapping("/{id}")
    public Map<String, TaskRepository.Task> update(@PathVariable long id, @RequestBody TaskRequest body) {
        AuthUser me = SecuritySupport.currentUser();
        TaskRepository.Task task = visibleTask(id);
        Epic epic = epics.findById(task.epicId()).orElseThrow();

        String title = body.title() == null ? task.title() : EpicController.requireText(body.title(), "Give the task a title", 200);
        String description = body.description() == null ? task.description() : EpicController.optionalText(body.description(), 5000);
        String status = body.status() == null ? task.status() : status(body.status());
        String priority = body.priority() == null ? task.priority() : priority(body.priority());
        Long assigneeId = task.assigneeId();
        String assigneeName = task.assigneeName();
        if (Boolean.TRUE.equals(body.unassign())) {
            assigneeId = null;
            assigneeName = null;
        } else if (body.assigneeId() != null && !body.assigneeId().equals(task.assigneeId())) {
            Epic.Member assignee = assignee(epic, body.assigneeId());
            assigneeId = assignee.userId();
            assigneeName = assignee.userName();
        }
        LocalDate dueDate = Boolean.TRUE.equals(body.clearDueDate()) ? null
                : body.dueDate() == null || body.dueDate().isBlank() ? task.dueDate() : EpicController.date(body.dueDate());
        BigDecimal estimate = body.estimateHours() == null ? task.estimateHours() : estimate(body.estimateHours());

        tasks.update(id, title, description, status, priority, assigneeId, assigneeName, dueDate, estimate);

        if (assigneeId != null && !assigneeId.equals(task.assigneeId()) && assigneeId != me.id()) {
            notifyAssigned(assigneeId, me, title, epic, id);
        }
        if ("done".equals(status) && !"done".equals(task.status())) {
            for (long userId : others(me.id(), task.createdBy(), task.assigneeId())) {
                notifier.user(userId, "task_done", me.name() + " finished \"" + title + "\"", epic.name(), "/tasks/" + id);
            }
        }
        return Map.of("task", tasks.findById(id).orElseThrow());
    }

    /** Managers, or the person who created the task. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        AuthUser me = SecuritySupport.currentUser();
        TaskRepository.Task task = visibleTask(id);
        if (!me.isManager() && task.createdBy() != me.id()) {
            throw new ApiException(403, "Only a manager or the person who added this task can delete it");
        }
        tasks.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, TaskRepository.Comment> comment(@PathVariable long id, @RequestBody CommentRequest body) {
        AuthUser me = SecuritySupport.currentUser();
        TaskRepository.Task task = visibleTask(id);
        String text = EpicController.requireText(body.body(), "Write a comment", 5000);
        TaskRepository.Comment comment = tasks.addComment(id, me.id(), me.name(), text);
        for (long userId : others(me.id(), task.createdBy(), task.assigneeId())) {
            notifier.user(userId, "task_comment", me.name() + " commented on \"" + task.title() + "\"", text,
                    "/tasks/" + id);
        }
        return Map.of("comment", comment);
    }

    private void notifyAssigned(long userId, AuthUser by, String title, Epic epic, long taskId) {
        notifier.user(userId, "task_assigned", by.name() + " gave you the task \"" + title + "\"",
                epic.name(), "/tasks/" + taskId);
    }

    /** The task's creator and assignee, without the person acting and without duplicates. */
    private static Set<Long> others(long me, long createdBy, Long assigneeId) {
        Set<Long> ids = new LinkedHashSet<>();
        ids.add(createdBy);
        if (assigneeId != null) {
            ids.add(assigneeId);
        }
        ids.remove(me);
        return ids;
    }

    /** Tasks go to people on the epic; managers add people to the epic first. */
    private static Epic.Member assignee(Epic epic, Long userId) {
        if (userId == null) {
            return null;
        }
        return epic.members().stream()
                .filter(m -> Objects.equals(m.userId(), userId))
                .findFirst()
                .orElseThrow(() -> new ApiException(400, "Tasks can only go to people on this epic"));
    }

    private Epic visibleEpic(long epicId) {
        AuthUser me = SecuritySupport.currentUser();
        Epic epic = epics.findById(epicId).orElseThrow(() -> new ApiException(404, "Epic not found"));
        if (!me.isManager() && !epic.hasMember(me.id())) {
            throw new ApiException(404, "Epic not found");
        }
        return epic;
    }

    /** Visible to managers, people on the epic, and whoever the task is assigned to. */
    private TaskRepository.Task visibleTask(long id) {
        AuthUser me = SecuritySupport.currentUser();
        TaskRepository.Task task = tasks.findById(id).orElseThrow(() -> new ApiException(404, "Task not found"));
        if (me.isManager() || Objects.equals(task.assigneeId(), me.id())) {
            return task;
        }
        Epic epic = epics.findById(task.epicId()).orElseThrow(() -> new ApiException(404, "Task not found"));
        if (!epic.hasMember(me.id())) {
            throw new ApiException(404, "Task not found");
        }
        return task;
    }

    private static String status(String value) {
        if (!STATUSES.contains(value)) {
            throw new ApiException(400, "Status must be " + STATUS_LABELS);
        }
        return value;
    }

    private static String priority(String value) {
        if (!PRIORITIES.contains(value)) {
            throw new ApiException(400, "Priority must be low, medium, high or urgent");
        }
        return value;
    }

    private static BigDecimal estimate(BigDecimal hours) {
        if (hours == null) {
            return null;
        }
        if (hours.signum() < 0 || hours.compareTo(BigDecimal.valueOf(999)) > 0) {
            throw new ApiException(400, "Estimate must be between 0 and 999 hours");
        }
        return hours;
    }
}
