package com.dailyupdate.project;

import com.dailyupdate.common.SecuritySupport;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notifications;

    public NotificationController(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public Map<String, Object> mine() {
        long me = SecuritySupport.currentUser().id();
        return Map.of("notifications", notifications.latest(me), "unread", notifications.unreadCount(me));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@PathVariable long id) {
        notifications.markRead(SecuritySupport.currentUser().id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll() {
        notifications.markRead(SecuritySupport.currentUser().id(), null);
        return ResponseEntity.noContent().build();
    }
}
