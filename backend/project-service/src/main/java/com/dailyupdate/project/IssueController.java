package com.dailyupdate.project;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Blockers and deadline problems raised by employees, with a reply thread for the manager. */
@RestController
@RequestMapping("/api/issues")
public class IssueController {

    private static final Set<String> TYPES = Set.of("blocker", "deadline", "other");
    private static final Set<String> SOURCES = Set.of("manual", "daily_log");

    public record IssueRequest(String type, String title, String description, Long epicId,
            List<Long> attachmentIds, String source) {}

    public record ReplyRequest(String body, List<Long> attachmentIds) {}

    public record StatusRequest(String status) {}

    private final IssueRepository issues;
    private final EpicRepository epics;
    private final AttachmentRepository attachments;
    private final Notifier notifier;

    public IssueController(IssueRepository issues, EpicRepository epics, AttachmentRepository attachments,
            Notifier notifier) {
        this.issues = issues;
        this.epics = epics;
        this.attachments = attachments;
        this.notifier = notifier;
    }

    /** Managers see everyone's issues; employees see their own. */
    @GetMapping
    public Map<String, List<IssueRepository.Issue>> list(@RequestParam(required = false) String status) {
        AuthUser me = SecuritySupport.currentUser();
        if (status != null && !Set.of("open", "resolved").contains(status)) {
            throw new ApiException(400, "Status must be open or resolved");
        }
        return Map.of("issues", issues.find(me.isManager() ? null : me.id(), status));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody IssueRequest body, @RequestHeader("Authorization") String auth) {
        AuthUser me = SecuritySupport.currentUser();
        String type = body.type() == null ? "other" : body.type();
        if (!TYPES.contains(type)) {
            throw new ApiException(400, "Type must be blocker, deadline or other");
        }
        String source = body.source() == null ? "manual" : body.source();
        if (!SOURCES.contains(source)) {
            throw new ApiException(400, "Unknown source");
        }
        String title = EpicController.requireText(body.title(), "A short title is required", 200);
        String description = EpicController.optionalText(body.description(), 5000);
        Long epicId = body.epicId();
        String epicName = null;
        if (epicId != null) {
            Epic epic = epics.findById(epicId)
                    .filter(e -> me.isManager() || e.hasMember(me.id()))
                    .orElseThrow(() -> new ApiException(400, "You are not on that epic"));
            epicName = epic.name();
        }
        long id = issues.insert(type, title, description, epicId, me.id(), me.name(), source);
        attachments.link(limit(body.attachmentIds()), me.id(), "issue", id);
        String label = switch (type) {
            case "blocker" -> "New blocker";
            case "deadline" -> "Deadline at risk";
            default -> "New issue";
        };
        notifier.managers(auth, me.id(), "issue_" + type,
                label + " from " + me.name() + (epicName == null ? "" : " on \"" + epicName + "\""),
                title, "/issues/" + id);
        return Map.of("issue", issues.findById(id).orElseThrow());
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable long id) {
        IssueRepository.Issue issue = visible(id);
        List<Map<String, Object>> replies = issues.replies(id).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("reply", r);
            m.put("attachments", attachments.findByOwner("reply", r.id()));
            return m;
        }).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("issue", issue);
        result.put("attachments", attachments.findByOwner("issue", id));
        result.put("replies", replies);
        return result;
    }

    /** The manager and the person who raised it can reply; the other side is notified. */
    @PostMapping("/{id}/replies")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> reply(@PathVariable long id, @RequestBody ReplyRequest body,
            @RequestHeader("Authorization") String auth) {
        AuthUser me = SecuritySupport.currentUser();
        IssueRepository.Issue issue = visible(id);
        String text = EpicController.requireText(body.body(), "Write a reply", 5000);
        long replyId = issues.addReply(id, me.id(), me.name(), me.role(), text);
        attachments.link(limit(body.attachmentIds()), me.id(), "reply", replyId);
        if (me.id() == issue.raisedBy()) {
            notifier.managers(auth, me.id(), "issue_reply", me.name() + " replied on \"" + issue.title() + "\"",
                    text, "/issues/" + id);
        } else {
            notifier.user(issue.raisedBy(), "issue_reply", me.name() + " replied on \"" + issue.title() + "\"",
                    text, "/issues/" + id);
        }
        return one(id);
    }

    /** Resolve or reopen. */
    @PatchMapping("/{id}")
    public Map<String, Object> setStatus(@PathVariable long id, @RequestBody StatusRequest body,
            @RequestHeader("Authorization") String auth) {
        AuthUser me = SecuritySupport.currentUser();
        IssueRepository.Issue issue = visible(id);
        if (!Set.of("open", "resolved").contains(String.valueOf(body.status()))) {
            throw new ApiException(400, "Status must be open or resolved");
        }
        if (!body.status().equals(issue.status())) {
            issues.setStatus(id, body.status());
            String verb = "resolved".equals(body.status()) ? "resolved" : "reopened";
            if (me.id() == issue.raisedBy()) {
                notifier.managers(auth, me.id(), "issue_status", me.name() + " " + verb + " \"" + issue.title() + "\"",
                        null, "/issues/" + id);
            } else {
                notifier.user(issue.raisedBy(), "issue_status", me.name() + " " + verb + " \"" + issue.title() + "\"",
                        null, "/issues/" + id);
            }
        }
        return one(id);
    }

    private IssueRepository.Issue visible(long id) {
        AuthUser me = SecuritySupport.currentUser();
        return issues.findById(id)
                .filter(i -> me.isManager() || i.raisedBy() == me.id())
                .orElseThrow(() -> new ApiException(404, "Issue not found"));
    }

    private static List<Long> limit(List<Long> ids) {
        return ids == null ? List.of() : ids.stream().distinct().limit(10).toList();
    }
}
