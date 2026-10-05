package com.dailyupdate.common;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Signs and verifies HS256 login tokens shared by every service. */
@Component
public class JwtService {

    private static final String ISSUER = "daily-update-auth";

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.ttl-hours:8}") long ttlHours) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("JWT_SECRET must be set and at least 32 characters long");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofHours(ttlHours);
    }

    public String sign(long userId, String role, String name, long companyId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .claim("role", role)
                .claim("name", name)
                .claim("cid", companyId)
                .issuer(ISSUER)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** Returns the user in a valid token, or throws {@link JwtException}. */
    public AuthUser verify(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .requireIssuer(ISSUER)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        try {
            return new AuthUser(
                    Long.parseLong(claims.getSubject()),
                    claims.get("role", String.class),
                    claims.get("name", String.class),
                    // Tokens from before workspaces existed have no company and are rejected.
                    claims.get("cid", Long.class));
        } catch (RuntimeException e) {
            throw new JwtException("Malformed token claims", e);
        }
    }
}
