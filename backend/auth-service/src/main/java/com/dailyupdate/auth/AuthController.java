package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.JwtService;
import com.dailyupdate.common.RateLimiter;
import com.dailyupdate.common.SecuritySupport;
import com.dailyupdate.common.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;
    private final Workspaces workspaces;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RateLimiter credentialLimiter;
    // Checked when the email is unknown so both failure paths take the same time.
    private final String dummyHash;

    public AuthController(UserRepository users, Workspaces workspaces,
            PasswordEncoder passwordEncoder, JwtService jwtService,
            @Value("${app.rate-limit.credentials-per-15-min}") int limit) {
        this.users = users;
        this.workspaces = workspaces;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.credentialLimiter = new RateLimiter(limit, Duration.ofMinutes(15));
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /** Logging in only works on a company's own address, and only for that company's accounts. */
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Requests.Login body, HttpServletRequest request) {
        limit(request);
        Company company = workspaces.require(request);
        return TenantContext.call(company.id(), () -> login(body, company));
    }

    private Map<String, Object> login(Requests.Login body, Company company) {
        String password = body.password() == null ? "" : body.password();
        var user = users.findByEmail(UserService.normalizeEmail(body.email()));
        boolean ok = passwordEncoder.matches(password, user.map(User::passwordHash).orElse(dummyHash));
        if (user.isEmpty() || !ok) {
            // Same answer for unknown email and wrong password so accounts can't be discovered.
            throw new ApiException(401, "Invalid email or password");
        }
        if (!user.get().active()) {
            throw new ApiException(403, "This account has been deactivated. Ask your admin.");
        }
        return session(user.get(), company);
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest request) {
        AuthUser current = SecuritySupport.currentUser();
        // A login only counts on its own workspace's address.
        workspaces.slugOf(request).ifPresent(slug -> {
            if (workspaces.find(slug).map(Company::id).filter(id -> id == current.companyId()).isEmpty()) {
                throw new ApiException(401, "Please log in to this workspace");
            }
        });
        // The website checks this on load, so a deactivated account is signed out right away.
        User user = users.findById(current.id()).filter(User::active)
                .orElseThrow(() -> new ApiException(401, "This account is no longer active"));
        return Map.of("user", user.toPublic());
    }

    /** Your own settings: the office you work from, which decides your holidays. */
    @PatchMapping("/me")
    public Map<String, Object> updateMe(@RequestBody Requests.MySettings body) {
        AuthUser current = SecuritySupport.currentUser();
        users.findById(current.id()).filter(User::active)
                .orElseThrow(() -> new ApiException(401, "This account is no longer active"));
        return Map.of("user", users.setOffice(current.id(), Workplace.office(body.office())).toPublic());
    }

    private Map<String, Object> session(User user, Company company) {
        return Map.of("token", jwtService.sign(user.id(), user.role(), user.name(), company.id()),
                "user", user.toPublic(), "workspace", company.toPublic());
    }

    private void limit(HttpServletRequest request) {
        // nginx sets X-Real-IP; services are only reachable through it.
        String ip = request.getHeader("X-Real-IP");
        credentialLimiter.check(ip != null ? ip : request.getRemoteAddr(), "Too many attempts, please try again later");
    }
}
