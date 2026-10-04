package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.Set;
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

/** Admins: add, edit, deactivate and reactivate any account, from interns to managers. */
@RestController
@RequestMapping("/api/admin/users")
public class AdminController {

    private static final Set<String> ROLES = Set.of(AuthUser.EMPLOYEE, AuthUser.MANAGER, AuthUser.ADMIN);

    private final UserRepository users;
    private final UserService userService;

    public AdminController(UserRepository users, UserService userService) {
        this.users = users;
        this.userService = userService;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("users", users.findEveryone().stream().map(User::toPublic).toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody Requests.CreateUser body) {
        User user = userService.create(body.name(), body.email(), body.password(), body.team(), body.position(),
                body.office(), role(body.role() == null ? AuthUser.EMPLOYEE : body.role()));
        return Map.of("user", user.toPublic());
    }

    /** Change name, login email, team, position or role. Fields left out stay as they are. */
    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable long id, @Valid @RequestBody Requests.AdminUpdate body) {
        AuthUser me = SecuritySupport.currentUser();
        if (me.id() == id && body.role() != null && !AuthUser.ADMIN.equals(body.role())) {
            throw new ApiException(409, "You can't remove your own admin access");
        }
        String role = body.role() == null ? null : role(body.role());
        return Map.of("user", userService.updateAccount(id, body.name(), body.email(), body.team(), body.position(),
                body.office(), role).toPublic());
    }

    @PostMapping("/{id}/password")
    public ResponseEntity<Void> resetPassword(@PathVariable long id, @Valid @RequestBody Requests.ResetPassword body) {
        userService.resetPassword(id, body.password());
        return ResponseEntity.noContent().build();
    }

    /** "Delete" deactivates: the person can't log in, but their history stays. */
    @DeleteMapping("/{id}")
    public Map<String, Object> deactivate(@PathVariable long id) {
        if (SecuritySupport.currentUser().id() == id) {
            throw new ApiException(409, "You can't deactivate your own account");
        }
        return Map.of("user", userService.setActive(id, false).toPublic());
    }

    @PostMapping("/{id}/activate")
    public Map<String, Object> activate(@PathVariable long id) {
        return Map.of("user", userService.setActive(id, true).toPublic());
    }

    private static String role(String role) {
        if (!ROLES.contains(role)) {
            throw new ApiException(400, "Role must be employee, manager or admin");
        }
        return role;
    }
}
