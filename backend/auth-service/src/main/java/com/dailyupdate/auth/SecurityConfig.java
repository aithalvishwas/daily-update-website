package com.dailyupdate.auth;

import com.dailyupdate.common.JwtService;
import com.dailyupdate.common.SecuritySupport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService) throws Exception {
        return SecuritySupport.apply(http, jwtService)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                        .requestMatchers("/actuator/health", "/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/managers", "/api/teams").authenticated()
                        .requestMatchers("/api/users/**", "/api/users", "/api/teams").hasRole("MANAGER")
                        .anyRequest().authenticated())
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
