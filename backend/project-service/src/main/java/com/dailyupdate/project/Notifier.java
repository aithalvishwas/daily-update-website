package com.dailyupdate.project;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Creates in-app notifications (the bell in the website). */
@Component
public class Notifier {

    private static final Logger log = LoggerFactory.getLogger(Notifier.class);

    private final NotificationRepository notifications;
    private final AuthClient authClient;

    public Notifier(NotificationRepository notifications, AuthClient authClient) {
        this.notifications = notifications;
        this.authClient = authClient;
    }

    public void user(long userId, String type, String title, String body, String link) {
        notifications.insert(userId, type, title, truncate(body), link);
    }

    /** Alerts every manager. A lookup failure is logged, never fails the caller's action. */
    public void managers(String authorization, long exceptUserId, String type, String title, String body, String link) {
        try {
            for (AuthClient.Person manager : authClient.managers(authorization)) {
                if (manager.id() != exceptUserId) {
                    user(manager.id(), type, title, body, link);
                }
            }
        } catch (RuntimeException e) {
            log.warn("Could not notify managers: {}", e.getMessage());
        }
    }

    private static String truncate(String text) {
        if (text == null) {
            return null;
        }
        return text.length() > 300 ? text.substring(0, 297) + "..." : text;
    }
}
