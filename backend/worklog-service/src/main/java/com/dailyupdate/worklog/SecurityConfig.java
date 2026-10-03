package com.dailyupdate.worklog;

import com.dailyupdate.common.JwtService;
import com.dailyupdate.common.SecuritySupport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService) throws Exception {
        return SecuritySupport.apply(http, jwtService)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/error").permitAll()
                        .requestMatchers("/api/logs/overview", "/api/logs/user/**").hasRole("MANAGER")
                        .anyRequest().authenticated())
                .build();
    }
}
