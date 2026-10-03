package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Manager-only endpoints (enforced in {@link SecurityConfig}). */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository users;
    private final UserService userService;

    public UserController(UserRepository users, UserService userService) {
        this.users = users;
        this.userService = userService;
    }

    @GetMapping
    public Map<String, Object> employees() {
        return Map.of("users", users.findEmployees().stream().map(User::toPublic).toList());
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable long id) {
        User user = users.findById(id).orElseThrow(() -> new ApiException(404, "User not found"));
        return Map.of("user", user.toPublic());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody Requests.CreateUser body) {
        String role = AuthUser.MANAGER.equals(body.role()) ? AuthUser.MANAGER : AuthUser.EMPLOYEE;
        User user = userService.create(body.name(), body.email(), body.password(), body.team(), role);
        return Map.of("user", user.toPublic());
    }
}
