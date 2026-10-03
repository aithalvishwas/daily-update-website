package com.dailyupdate.summary;

import com.dailyupdate.common.ApiException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * Calls the auth and work-log services with the caller's own token,
 * so each service enforces its own access rules.
 */
@Component
public class ServiceClients {

    public record Employee(long id, String name, String email, String role, String team) {}

    public record LogEntry(LocalDate workDate, String tasks, BigDecimal hours, String blockers) {}

    private record UserResponse(Employee user) {}

    private record LogsResponse(List<LogEntry> logs) {}

    private final RestClient auth;
    private final RestClient worklog;

    public ServiceClients(
            @Value("${services.auth-url}") String authUrl,
            @Value("${services.worklog-url}") String worklogUrl) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(15));
        this.auth = RestClient.builder().requestFactory(requestFactory).baseUrl(authUrl).build();
        this.worklog = RestClient.builder().requestFactory(requestFactory).baseUrl(worklogUrl).build();
    }

    public Employee employee(long userId, String authorization) {
        try {
            return auth.get().uri("/api/users/{id}", userId)
                    .header("Authorization", authorization)
                    .retrieve().body(UserResponse.class).user();
        } catch (RestClientResponseException e) {
            throw upstream(e, "User not found");
        } catch (RestClientException e) {
            throw new ApiException(502, "Auth service unavailable");
        }
    }

    public List<LogEntry> logs(long userId, LocalDate from, LocalDate to, String authorization) {
        try {
            return worklog.get().uri("/api/logs/user/{id}?from={from}&to={to}", userId, from, to)
                    .header("Authorization", authorization)
                    .retrieve().body(LogsResponse.class).logs();
        } catch (RestClientResponseException e) {
            throw upstream(e, "Logs not found");
        } catch (RestClientException e) {
            throw new ApiException(502, "Work log service unavailable");
        }
    }

    private static ApiException upstream(RestClientResponseException e, String notFound) {
        return switch (e.getStatusCode().value()) {
            case 404 -> new ApiException(404, notFound);
            case 401, 403 -> new ApiException(e.getStatusCode().value(), "Not allowed");
            default -> new ApiException(502, "Upstream error " + e.getStatusCode().value());
        };
    }
}
