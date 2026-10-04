package com.dailyupdate.summary;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.RateLimiter;
import com.dailyupdate.common.SecuritySupport;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Manager-only endpoints (enforced in {@link SecurityConfig}). */
@RestController
@RequestMapping("/api/summaries")
public class SummaryController {

    private static final List<Integer> ALLOWED_DAYS = List.of(7, 14, 30);

    public record GenerateRequest(Integer days) {}

    private final SummaryRepository summaries;
    private final ServiceClients services;
    private final Summarizer summarizer;
    // AI calls cost money, so cap how many summaries one manager can generate.
    private final RateLimiter limiter;

    public SummaryController(SummaryRepository summaries, ServiceClients services, Summarizer summarizer,
            @Value("${app.rate-limit.summaries-per-hour}") int perHour) {
        this.summaries = summaries;
        this.services = services;
        this.summarizer = summarizer;
        this.limiter = new RateLimiter(perHour, Duration.ofHours(1));
    }

    @GetMapping("/{userId}")
    public Map<String, Object> latest(@PathVariable long userId) {
        Map<String, Object> body = new HashMap<>();
        body.put("summary", summaries.latest(userId).orElse(null));
        return body;
    }

    @PostMapping("/{userId}")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> generate(@PathVariable long userId,
            @RequestBody(required = false) GenerateRequest body,
            @RequestHeader("Authorization") String authorization) {
        AuthUser manager = SecuritySupport.currentUser();
        int days = body == null || body.days() == null ? 7 : body.days();
        if (!ALLOWED_DAYS.contains(days)) {
            throw new ApiException(400, "days must be one of 7, 14, 30");
        }
        limiter.check("user:" + manager.id(), "Summary limit reached, please try again later");

        LocalDate to = LocalDate.now(ZoneOffset.UTC);
        LocalDate from = to.minusDays(days - 1L);
        var employee = services.employee(userId, authorization);
        var logs = services.logs(userId, from, to, authorization);
        if (logs.isEmpty()) {
            throw new ApiException(422, employee.name() + " has no work logs in the last " + days + " days");
        }
        Summarizer.Result result = summarizer.summarize(employee.name(), from, to, logs);
        return Map.of("summary", summaries.insert(userId, from, to, logs.size(), result, manager.id()));
    }
}
