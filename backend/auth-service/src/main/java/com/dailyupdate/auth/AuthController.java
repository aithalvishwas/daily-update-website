package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.JwtService;
import com.dailyupdate.common.RateLimiter;
import com.dailyupdate.common.SecuritySupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RateLimiter credentialLimiter;
    // Checked when the email is unknown so both failure paths take the same time.
    private final String dummyHash;

    public AuthController(UserRepository users, UserService userService, PasswordEncoder passwordEncoder,
            JwtService jwtService, @Value("${app.rate-limit.credentials-per-15-min}") int limit) {
        this.users = users;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.credentialLimiter = new RateLimiter(limit, Duration.ofMinutes(15));
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /** Self sign-up always creates an employee. Managers are seeded or created by a manager. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> register(@Valid @RequestBody Requests.Register body, HttpServletRequest request) {
        limit(request);
        User user = userService.create(body.name(), body.email(), body.password(), body.team(), AuthUser.EMPLOYEE);
        return session(user);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Requests.Login body, HttpServletRequest request) {
        limit(request);
        String password = body.password() == null ? "" : body.password();
        var user = users.findByEmail(UserService.normalizeEmail(body.email()));
        boolean ok = passwordEncoder.matches(password, user.map(User::passwordHash).orElse(dummyHash));
        if (user.isEmpty() || !ok) {
            // Same answer for unknown email and wrong password so accounts can't be discovered.
            throw new ApiException(401, "Invalid email or password");
        }
        return session(user.get());
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        AuthUser current = SecuritySupport.currentUser();
        User user = users.findById(current.id()).orElseThrow(() -> new ApiException(404, "User not found"));
        return Map.of("user", user.toPublic());
    }

    private Map<String, Object> session(User user) {
        return Map.of("token", jwtService.sign(user.id(), user.role(), user.name()), "user", user.toPublic());
    }

    private void limit(HttpServletRequest request) {
        // nginx sets X-Real-IP; services are only reachable through it.
        String ip = request.getHeader("X-Real-IP");
        credentialLimiter.check(ip != null ? ip : request.getRemoteAddr(), "Too many attempts, please try again later");
    }
}
