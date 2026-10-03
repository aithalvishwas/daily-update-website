package com.dailyupdate.common;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/** Security settings every service shares: stateless JWT auth and JSON 401/403 errors. */
public final class SecuritySupport {

    private SecuritySupport() {}

    public static HttpSecurity apply(HttpSecurity http, JwtService jwtService) throws Exception {
        return http
                .csrf(csrf -> csrf.disable()) // no cookies are used, tokens travel in the Authorization header
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> {
                            Object reason = req.getAttribute("auth.error");
                            writeError(res, 401, reason != null
                                    ? reason.toString()
                                    : "Missing or invalid Authorization header");
                        })
                        .accessDeniedHandler((req, res, ex) -> writeError(res, 403, "Forbidden")));
    }

    /** The signed-in user for the current request. */
    public static AuthUser currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthUser user)) {
            throw new ApiException(401, "Not signed in");
        }
        return user;
    }

    /** The signed-in user, who must be a manager. */
    public static AuthUser requireManager() {
        AuthUser user = currentUser();
        if (!user.isManager()) {
            throw new ApiException(403, "Forbidden");
        }
        return user;
    }

    private static void writeError(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"" + message.replace("\"", "'") + "\"}");
    }
}
