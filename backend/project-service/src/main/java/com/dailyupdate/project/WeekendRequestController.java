package com.dailyupdate.project;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The work week is Monday to Friday. Work on a Saturday or Sunday can be claimed as a comp-off day
 * or as paid overtime; a manager approves, rejects or suggests an alternative.
 */
@RestController
@RequestMapping("/api/weekend-requests")
public class WeekendRequestController {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.ENGLISH);

    public record SubmitRequest(String workDate, BigDecimal hours, String compensation, String reason) {}

    public record DecisionRequest(String decision, String note, String alternative) {}

    private final WeekendRequestRepository requests;
    private final Notifier notifier;

    public WeekendRequestController(WeekendRequestRepository requests, Notifier notifier) {
        this.requests = requests;
        this.notifier = notifier;
    }

    @GetMapping
    public Map<String, List<WeekendRequestRepository.WeekendRequest>> list() {
        AuthUser me = SecuritySupport.currentUser();
        return Map.of("requests", requests.find(me.isManager() ? null : me.id()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, WeekendRequestRepository.WeekendRequest> submit(@RequestBody SubmitRequest body,
            @RequestHeader("Authorization") String auth) {
        AuthUser me = SecuritySupport.currentUser();
        LocalDate day = EpicController.date(body.workDate());
        if (day.getDayOfWeek() != DayOfWeek.SATURDAY && day.getDayOfWeek() != DayOfWeek.SUNDAY) {
            throw new ApiException(400, "Pick a Saturday or Sunday; the work week is Monday to Friday");
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (day.isAfter(today.plusDays(1)) || day.isBefore(today.minusDays(60))) {
            throw new ApiException(400, "Pick a weekend day from the last 60 days");
        }
        if (body.hours() == null || body.hours().signum() <= 0 || body.hours().compareTo(BigDecimal.valueOf(24)) > 0) {
            throw new ApiException(400, "Hours must be more than 0 and at most 24");
        }
        if (!"comp_off".equals(body.compensation()) && !"paid".equals(body.compensation())) {
            throw new ApiException(400, "Choose comp_off or paid");
        }
        var saved = requests.submit(me.id(), me.name(), day, body.hours().setScale(1, RoundingMode.HALF_UP),
                body.compensation(), EpicController.optionalText(body.reason(), 2000))
                .orElseThrow(() -> new ApiException(409, "You already have a request for that day"));
        notifier.managers(auth, me.id(), "weekend_request",
                me.name() + " asks for " + label(saved.compensation()) + " for " + DAY.format(day),
                hours(saved.hours()) + " hours" + (saved.reason() == null ? "" : ": " + saved.reason()),
                "/requests/" + saved.id());
        return Map.of("request", saved);
    }

    /** Manager: approve, reject, or suggest an alternative (for example comp-off instead of pay). */
    @PostMapping("/{id}/decision")
    public Map<String, WeekendRequestRepository.WeekendRequest> decide(@PathVariable long id,
            @RequestBody DecisionRequest body) {
        AuthUser me = SecuritySupport.requireManager();
        var current = requests.findById(id).orElseThrow(() -> new ApiException(404, "Request not found"));
        String note = EpicController.optionalText(body.note(), 2000);
        String status;
        String alternative = null;
        switch (String.valueOf(body.decision())) {
            case "approve" -> status = "approved";
            case "reject" -> status = "rejected";
            case "alternative" -> {
                status = "alternative";
                alternative = EpicController.requireText(body.alternative(), "Describe the alternative", 2000);
            }
            default -> throw new ApiException(400, "Decision must be approve, reject or alternative");
        }
        if (!requests.decide(id, "pending", status, note, alternative, me.name())) {
            throw new ApiException(409, "This request has already been decided");
        }
        String what = label(current.compensation()) + " for " + DAY.format(current.workDate());
        String title = switch (status) {
            case "approved" -> me.name() + " approved your " + what;
            case "rejected" -> me.name() + " declined your " + what;
            default -> me.name() + " suggested an alternative for your " + what;
        };
        notifier.user(current.userId(), "weekend_decision", title,
                alternative != null ? alternative : note, "/requests/" + id);
        return Map.of("request", requests.findById(id).orElseThrow());
    }

    /** Owner: agree to the manager's suggested alternative. */
    @PostMapping("/{id}/accept-alternative")
    public Map<String, WeekendRequestRepository.WeekendRequest> acceptAlternative(@PathVariable long id,
            @RequestHeader("Authorization") String auth) {
        AuthUser me = SecuritySupport.currentUser();
        var current = owned(id, me);
        if (!requests.ownerSetStatus(id, me.id(), List.of("alternative"), "approved")) {
            throw new ApiException(409, "There is no alternative to accept");
        }
        notifier.managers(auth, me.id(), "weekend_request",
                me.name() + " accepted the alternative for " + DAY.format(current.workDate()), current.alternative(),
                "/requests/" + id);
        return Map.of("request", requests.findById(id).orElseThrow());
    }

    /** Owner: withdraw a request that is pending or has an alternative waiting. */
    @PostMapping("/{id}/cancel")
    public Map<String, WeekendRequestRepository.WeekendRequest> cancel(@PathVariable long id) {
        AuthUser me = SecuritySupport.currentUser();
        owned(id, me);
        if (!requests.ownerSetStatus(id, me.id(), List.of("pending", "alternative"), "cancelled")) {
            throw new ApiException(409, "Only open requests can be cancelled");
        }
        return Map.of("request", requests.findById(id).orElseThrow());
    }

    private WeekendRequestRepository.WeekendRequest owned(long id, AuthUser me) {
        return requests.findById(id).filter(r -> r.userId() == me.id())
                .orElseThrow(() -> new ApiException(404, "Request not found"));
    }

    private static String hours(BigDecimal hours) {
        return hours.stripTrailingZeros().toPlainString();
    }

    private static String label(String compensation) {
        return "comp_off".equals(compensation) ? "a comp-off day" : "overtime pay";
    }
}
