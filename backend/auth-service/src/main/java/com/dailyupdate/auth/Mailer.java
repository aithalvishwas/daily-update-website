package com.dailyupdate.auth;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Sends email through Resend's HTTP API (https://resend.com). The server can't use SMTP because
 * DigitalOcean blocks it. Without RESEND_API_KEY nothing is sent and admins copy the link instead.
 */
@Component
public class Mailer {

    private static final Logger log = LoggerFactory.getLogger(Mailer.class);

    private final String apiKey;
    private final String from;
    private final RestClient client = RestClient.create("https://api.resend.com");

    public Mailer(@Value("${app.mail.resend-api-key}") String apiKey, @Value("${app.mail.from}") String from) {
        this.apiKey = apiKey;
        this.from = from;
    }

    public boolean enabled() {
        return !apiKey.isBlank();
    }

    /** Returns whether the email went out. Failures are logged, never thrown. */
    public boolean send(String to, String subject, String text, String html) {
        if (!enabled()) {
            return false;
        }
        try {
            client.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("from", from, "to", List.of(to), "subject", subject, "text", text, "html", html))
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientException e) {
            log.warn("Could not send email to {}: {}", to, e.getMessage());
            return false;
        }
    }
}
