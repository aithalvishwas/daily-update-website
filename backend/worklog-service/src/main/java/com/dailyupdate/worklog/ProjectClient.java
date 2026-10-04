package com.dailyupdate.worklog;

import com.dailyupdate.common.ApiException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Talks to the project-service with the caller's own token. */
@Component
public class ProjectClient {

    private static final Logger log = LoggerFactory.getLogger(ProjectClient.class);

    public record EpicRef(long id, String name) {}

    private record EpicResponse(EpicRef epic) {}

    private final RestClient client;

    public ProjectClient(@Value("${services.project-url}") String projectUrl) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().requestFactory(requestFactory).baseUrl(projectUrl).build();
    }

    /** The epic, if the caller can see it (is on it, or is a manager). */
    public Optional<EpicRef> epic(long id, String authorization) {
        try {
            return Optional.ofNullable(client.get().uri("/api/epics/{id}", id).header("Authorization", authorization)
                    .retrieve().body(EpicResponse.class)).map(EpicResponse::epic);
        } catch (HttpClientErrorException e) {
            return Optional.empty();
        } catch (RestClientException e) {
            throw new ApiException(502, "Project service unavailable");
        }
    }

    /** Sends a blocker from a daily update to the manager's alerts. Never fails the caller's save. */
    public void raiseBlocker(String blockers, Long epicId, String authorization) {
        String title = blockers.lines().map(String::strip).filter(s -> !s.isEmpty()).findFirst().orElse(blockers);
        if (title.length() > 120) {
            title = title.substring(0, 117) + "...";
        }
        var body = new HashMap<String, Object>();
        body.put("type", "blocker");
        body.put("source", "daily_log");
        body.put("title", title);
        body.put("description", blockers);
        body.put("epicId", epicId);
        try {
            client.post().uri("/api/issues").header("Authorization", authorization)
                    .body(body)
                    .retrieve().toBodilessEntity();
        } catch (RestClientException e) {
            log.warn("Could not raise blocker alert: {}", e.getMessage());
        }
    }
}
