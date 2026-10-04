package com.dailyupdate.project;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Milestones inside an epic. Managers plan them; anyone on the epic can tick one off. */
@RestController
@RequestMapping("/api/epics/{epicId}/milestones")
public class MilestoneController {

    public record MilestoneRequest(String name, String dueDate, Boolean done) {}

    private final MilestoneRepository milestones;
    private final EpicRepository epics;

    public MilestoneController(MilestoneRepository milestones, EpicRepository epics) {
        this.milestones = milestones;
        this.epics = epics;
    }

    @GetMapping
    public Map<String, List<MilestoneRepository.Milestone>> list(@PathVariable long epicId) {
        visibleEpic(epicId);
        return Map.of("milestones", milestones.findForEpic(epicId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, MilestoneRepository.Milestone> create(@PathVariable long epicId,
            @RequestBody MilestoneRequest body) {
        SecuritySupport.requireManager();
        visibleEpic(epicId);
        return Map.of("milestone", milestones.insert(epicId,
                EpicController.requireText(body.name(), "Name the milestone", 150), EpicController.date(body.dueDate())));
    }

    @PatchMapping("/{id}")
    public Map<String, MilestoneRepository.Milestone> update(@PathVariable long epicId, @PathVariable long id,
            @RequestBody MilestoneRequest body) {
        AuthUser me = SecuritySupport.currentUser();
        visibleEpic(epicId);
        MilestoneRepository.Milestone current = milestone(epicId, id);
        if (!me.isManager() && (body.name() != null || body.dueDate() != null)) {
            throw new ApiException(403, "Only managers can rename or move a milestone");
        }
        String name = body.name() == null ? current.name() : EpicController.requireText(body.name(), "Name the milestone", 150);
        return Map.of("milestone", milestones.update(id, name,
                body.dueDate() == null ? current.dueDate() : EpicController.date(body.dueDate()),
                body.done() == null ? current.done() : body.done()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long epicId, @PathVariable long id) {
        SecuritySupport.requireManager();
        milestone(epicId, id);
        milestones.delete(id);
        return ResponseEntity.noContent().build();
    }

    private MilestoneRepository.Milestone milestone(long epicId, long id) {
        return milestones.findById(id)
                .filter(m -> m.epicId() == epicId)
                .orElseThrow(() -> new ApiException(404, "Milestone not found"));
    }

    private void visibleEpic(long epicId) {
        AuthUser me = SecuritySupport.currentUser();
        Epic epic = epics.findById(epicId).orElseThrow(() -> new ApiException(404, "Epic not found"));
        if (!me.isManager() && !epic.hasMember(me.id())) {
            throw new ApiException(404, "Epic not found");
        }
    }
}
