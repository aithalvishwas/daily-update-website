package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.SecuritySupport;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** People and teams. Access rules are in {@link SecurityConfig}. */
@RestController
public class UserController {

    public record Person(long id, String name) {}

    private final UserRepository users;
    private final TeamRepository teams;
    private final UserService userService;

    public UserController(UserRepository users, TeamRepository teams, UserService userService) {
        this.users = users;
        this.teams = teams;
        this.userService = userService;
    }

    /** Managers: employees, or everyone with {@code ?all=true}. */
    @GetMapping("/api/users")
    public Map<String, Object> list(@RequestParam(defaultValue = "false") boolean all) {
        var list = all ? users.findAll() : users.findEmployees();
        return Map.of("users", list.stream().map(User::toPublic).toList());
    }

    /** Any signed-in user: who the managers are (used to route alerts). */
    @GetMapping("/api/users/managers")
    public Map<String, List<Person>> managers() {
        return Map.of("managers", users.findManagers().stream().map(u -> new Person(u.id(), u.name())).toList());
    }

    @GetMapping("/api/users/{id}")
    public Map<String, Object> one(@PathVariable long id) {
        User user = users.findById(id).orElseThrow(() -> new ApiException(404, "User not found"));
        return Map.of("user", user.toPublic());
    }

    @PostMapping("/api/users")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody Requests.CreateUser body) {
        User user = userService.create(body.name(), body.email(), body.password(), body.team(), body.position(),
                body.office(), roleOrDefault(body.role()));
        return Map.of("user", user.toPublic());
    }

    /** Managers: change team or position, or promote. Fields left out stay as they are. */
    @PatchMapping("/api/users/{id}")
    public Map<String, Object> update(@PathVariable long id, @Valid @RequestBody Requests.UpdateUser body) {
        User target = users.findById(id).orElseThrow(() -> new ApiException(404, "User not found"));
        if (AuthUser.ADMIN.equals(target.role()) && !SecuritySupport.currentUser().isAdmin()) {
            throw new ApiException(403, "Only an admin can change an admin account");
        }
        String role = body.role() == null ? null : roleOrDefault(body.role());
        return Map.of("user", userService.update(id, body.team(), body.position(), role).toPublic());
    }

    @GetMapping("/api/teams")
    public Map<String, Object> teams() {
        return Map.of("teams", teams.findAll());
    }

    @PostMapping("/api/teams")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createTeam(@Valid @RequestBody Requests.CreateTeam body) {
        teams.ensure(body.name().trim());
        return Map.of("teams", teams.findAll());
    }

    private static String roleOrDefault(String role) {
        return AuthUser.MANAGER.equals(role) ? AuthUser.MANAGER : AuthUser.EMPLOYEE;
    }
}
