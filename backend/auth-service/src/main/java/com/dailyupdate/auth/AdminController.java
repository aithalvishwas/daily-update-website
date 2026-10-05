package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    private final PasswordLinks passwordLinks;
    private final Workspaces workspaces;

    public AdminController(UserRepository users, UserService userService, PasswordLinks passwordLinks,
            Workspaces workspaces) {
        this.users = users;
        this.userService = userService;
        this.passwordLinks = passwordLinks;
        this.workspaces = workspaces;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("users", users.findEveryone().stream().map(User::toPublic).toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody Requests.CreateUser body, HttpServletRequest request) {
        boolean invite = body.password() == null;
        Company company = invite ? myCompany(request) : null;
        // An invited person can't log in until they choose a password from the emailed link.
        String password = invite ? UUID.randomUUID().toString() : body.password();
        User user = userService.create(body.name(), body.email(), password, body.team(), body.position(),
                body.office(), role(body.role() == null ? AuthUser.EMPLOYEE : body.role()));
        if (!invite) {
            return Map.of("user", user.toPublic());
        }
        var sent = passwordLinks.send(user, company, workspaces.address(company, request), true);
        return Map.of("user", users.findById(user.id()).orElseThrow().toPublic(), "link", sent.url(),
                "emailed", sent.emailed());
    }

    /**
     * Emails a fresh link to choose a password: the invite again if they never set one, otherwise a
     * reset. The link is also returned so the admin can share it another way.
     */
    @PostMapping("/{id}/password-link")
    public Map<String, Object> sendPasswordLink(@PathVariable long id, HttpServletRequest request) {
        Company company = myCompany(request);
        User user = users.findById(id).filter(User::active).orElseThrow(() -> new ApiException(404, "User not found"));
        var sent = passwordLinks.send(user, company, workspaces.address(company, request), user.invitePending());
        return Map.of("link", sent.url(), "emailed", sent.emailed());
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

    /** The workspace this admin belongs to, which must be the address they're using. */
    private Company myCompany(HttpServletRequest request) {
        Company company = workspaces.require(request);
        if (company.id() != SecuritySupport.currentUser().companyId()) {
            throw new ApiException(401, "Please log in to this workspace");
        }
        return company;
    }

    private static String role(String role) {
        if (!ROLES.contains(role)) {
            throw new ApiException(400, "Role must be employee, manager or admin");
        }
        return role;
    }
}
