package com.dailyupdate.common;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Reads "Authorization: Bearer ..." and, when the token is valid, signs the request in. */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                AuthUser user = jwtService.verify(header.substring(7));
                // Admins also hold the manager role, so every manager rule applies to them.
                var authorities = user.isAdmin()
                        ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_MANAGER"))
                        : List.of(new SimpleGrantedAuthority("ROLE_" + user.role().toUpperCase()));
                var auth = new UsernamePasswordAuthenticationToken(user, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException | IllegalArgumentException e) {
                // Invalid token: stay anonymous; protected endpoints answer 401.
                SecurityContextHolder.clearContext();
                request.setAttribute("auth.error", "Invalid or expired token");
            }
        }
        chain.doFilter(request, response);
    }
}
