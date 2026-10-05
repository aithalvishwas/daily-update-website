package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

/**
 * One-time links that let someone choose their own password: an invite when an admin adds them, or
 * a reset later. A link works once, for {@value #VALID_DAYS} days, and a newer link replaces older
 * ones. Runs inside the company's tenant scope.
 */
@Service
public class PasswordLinks {

    static final int VALID_DAYS = 7;

    private final JdbcClient jdbc;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Mailer mailer;
    private final String rootDomain;
    private final SecureRandom random = new SecureRandom();

    public PasswordLinks(JdbcClient jdbc, UserRepository users, PasswordEncoder passwordEncoder, Mailer mailer,
            @Value("${app.root-domain}") String rootDomain) {
        this.jdbc = jdbc;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.mailer = mailer;
        this.rootDomain = rootDomain;
    }

    /** What the admin sees: the link (to copy if email is off or fails) and whether it was emailed. */
    public record Sent(String url, boolean emailed) {}

    /**
     * Creates a fresh link for the user and emails it. {@code address} is the company's own host
     * ({@link Workspaces#address}); {@code invite} picks the wording.
     */
    @Transactional
    public Sent send(User user, Company company, String address, boolean invite) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.sql("UPDATE password_links SET used_at = now() WHERE user_id = :user AND used_at IS NULL")
                .param("user", user.id())
                .update();
        jdbc.sql("""
                        INSERT INTO password_links (user_id, token_hash, expires_at)
                        VALUES (:user, :hash, now() + make_interval(days => :days))""")
                .param("user", user.id())
                .param("hash", hash(token))
                .param("days", VALID_DAYS)
                .update();
        if (invite) {
            users.markInvited(user.id());
        }
        String url = (isLocal() ? "http://" : "https://") + address + "/#/set-password?token=" + token;
        return new Sent(url, mailer.send(user.email(), subject(company, invite), text(user, company, url, invite),
                html(user, company, url, invite)));
    }

    /** Sets the password if the link is valid and unused, and returns the user to log in. */
    @Transactional
    public User use(String token, String password) {
        Optional<Long> userId = jdbc.sql("""
                        UPDATE password_links SET used_at = now()
                        WHERE token_hash = :hash AND used_at IS NULL AND expires_at > now()
                        RETURNING user_id""")
                .param("hash", hash(token == null ? "" : token))
                .query(Long.class)
                .optional();
        User user = userId.flatMap(users::findById).filter(User::active)
                .orElseThrow(() -> new ApiException(400, "This link has expired or was already used. Ask your admin for a new one."));
        users.setPassword(user.id(), passwordEncoder.encode(password));
        return users.findById(user.id()).orElseThrow();
    }

    private boolean isLocal() {
        return "localhost".equals(rootDomain);
    }

    private static String subject(Company company, boolean invite) {
        return invite ? "You're invited to " + company.name() + " on WorkPulseLens"
                : "Set a new WorkPulseLens password";
    }

    private static String text(User user, Company company, String url, boolean invite) {
        String intro = invite
                ? "You've been added to " + company.name() + " on WorkPulseLens. Choose a password to get started:"
                : "Use this link to choose a new password for " + company.name() + " on WorkPulseLens:";
        return "Hi " + firstName(user) + ",\n\n" + intro + "\n\n" + url + "\n\nThe link works once and expires in "
                + VALID_DAYS + " days. Your login email is " + user.email() + ".\n";
    }

    private static String html(User user, Company company, String url, boolean invite) {
        String name = HtmlUtils.htmlEscape(firstName(user));
        String companyName = HtmlUtils.htmlEscape(company.name());
        String intro = invite
                ? "You've been added to <strong>" + companyName + "</strong> on WorkPulseLens. Choose a password to get started."
                : "Use the button below to choose a new password for <strong>" + companyName + "</strong> on WorkPulseLens.";
        String href = HtmlUtils.htmlEscape(url);
        return """
                <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;line-height:1.5">
                  <p style="font-size:18px;font-weight:600;color:#1e3a8a">WorkPulseLens</p>
                  <p>Hi %s,</p>
                  <p>%s</p>
                  <p style="margin:28px 0"><a href="%s" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">%s</a></p>
                  <p style="color:#6b7280;font-size:13px">The link works once and expires in %d days. Your login email is %s.<br>If the button doesn't work, paste this into your browser:<br><a href="%s" style="color:#2563eb;word-break:break-all">%s</a></p>
                </div>""".formatted(name, intro, href, invite ? "Set your password" : "Choose a new password", VALID_DAYS,
                HtmlUtils.htmlEscape(user.email()), href, href);
    }

    private static String firstName(User user) {
        return user.name().trim().split("\\s+")[0];
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
