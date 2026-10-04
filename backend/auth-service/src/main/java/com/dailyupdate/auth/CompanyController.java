package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
import com.dailyupdate.common.RateLimiter;
import com.dailyupdate.common.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Company sign-up on the public site, and which workspace an address belongs to. */
@RestController
@RequestMapping("/api/companies")
public class CompanyController {

    private final CompanyRepository companies;
    private final Workspaces workspaces;
    private final UserService userService;
    private final HolidaySeeder holidays;
    private final TransactionTemplate tx;
    private final RateLimiter signupLimiter;

    public CompanyController(CompanyRepository companies, Workspaces workspaces, UserService userService,
            HolidaySeeder holidays, TransactionTemplate tx,
            @Value("${app.rate-limit.signups-per-hour}") int limit) {
        this.companies = companies;
        this.workspaces = workspaces;
        this.userService = userService;
        this.holidays = holidays;
        this.tx = tx;
        this.signupLimiter = new RateLimiter(limit, Duration.ofHours(1));
    }

    /**
     * The workspace this address belongs to. {@code workspace} is null on the public site;
     * {@code missing} is set when the address looks like a workspace that doesn't exist.
     */
    @GetMapping("/current")
    public Map<String, Object> current(HttpServletRequest request) {
        var body = new HashMap<String, Object>();
        body.put("rootDomain", workspaces.rootDomain());
        body.put("workspace", null);
        workspaces.slugOf(request).ifPresent(slug -> companies.findBySlug(slug).ifPresentOrElse(
                c -> body.put("workspace", c.toPublic()),
                () -> body.put("missing", slug)));
        return body;
    }

    /** Whether a workspace address is free, for the sign-up form. */
    @GetMapping("/check")
    public Map<String, Object> check(@RequestParam String slug) {
        try {
            String clean = workspaces.validSlug(slug);
            return Map.of("slug", clean, "available", !companies.slugTaken(clean));
        } catch (ApiException e) {
            return Map.of("slug", slug, "available", false, "reason", e.getMessage());
        }
    }

    /** Asked by Caddy before it gets an HTTPS certificate for an address: only real workspaces get one. */
    @GetMapping("/tls-check")
    public ResponseEntity<Void> tlsCheck(@RequestParam String domain) {
        String host = domain.trim().toLowerCase();
        String root = workspaces.rootDomain();
        boolean ours = host.equals(root) || host.equals("www." + root)
                || workspaces.slugOf(host).map(companies::slugTaken).orElse(false);
        return ResponseEntity.status(ours ? HttpStatus.OK : HttpStatus.NOT_FOUND).build();
    }

    /** A company signs up: creates its workspace with the person signing up as its admin. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> signUp(@Valid @RequestBody Requests.CompanySignup body, HttpServletRequest request) {
        String ip = request.getHeader("X-Real-IP");
        signupLimiter.check(ip != null ? ip : request.getRemoteAddr(), "Too many sign-ups, please try again later");
        String slug = workspaces.validSlug(body.slug());
        if (companies.slugTaken(slug)) {
            throw new ApiException(409, "That workspace address is taken");
        }
        long id = companies.nextId();
        try {
            Company company = TenantContext.call(id, () -> tx.execute(status -> {
                Company created = companies.insert(id, slug, body.companyName().trim(),
                        UserService.blankToNull(body.orgSize()), UserService.blankToNull(body.phone()));
                userService.create(body.name(), body.email(), body.password(), null, "Admin", AuthUser.ADMIN);
                holidays.seed();
                return created;
            }));
            return Map.of("workspace", company.toPublic(), "rootDomain", workspaces.rootDomain());
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "That workspace address is taken");
        }
    }
}
