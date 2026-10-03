package com.dailyupdate.project;

import com.dailyupdate.common.ApiException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Looks up people in the auth-service, using the caller's own token. */
@Component
public class AuthClient {

    public record Person(long id, String name) {}

    private record ManagersResponse(List<Person> managers) {}

    private record UsersResponse(List<Person> users) {}

    private final RestClient client;

    public AuthClient(@Value("${services.auth-url}") String authUrl) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().requestFactory(requestFactory).baseUrl(authUrl).build();
    }

    public List<Person> managers(String authorization) {
        try {
            return client.get().uri("/api/users/managers").header("Authorization", authorization)
                    .retrieve().body(ManagersResponse.class).managers();
        } catch (RestClientException e) {
            throw new ApiException(502, "Auth service unavailable");
        }
    }

    /** Manager token only: every user by id. */
    public Map<Long, Person> everyone(String authorization) {
        try {
            return client.get().uri("/api/users?all=true").header("Authorization", authorization)
                    .retrieve().body(UsersResponse.class).users().stream()
                    .collect(Collectors.toMap(Person::id, Function.identity()));
        } catch (RestClientException e) {
            throw new ApiException(502, "Auth service unavailable");
        }
    }
}
