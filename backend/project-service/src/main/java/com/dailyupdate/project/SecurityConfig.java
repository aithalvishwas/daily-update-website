package com.dailyupdate.project;

import com.dailyupdate.common.JwtService;
import com.dailyupdate.common.SecuritySupport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/** Every endpoint needs a signed-in user; manager-only actions are checked in the controllers. */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService) throws Exception {
        return SecuritySupport.apply(http, jwtService)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/error").permitAll()
                        .anyRequest().authenticated())
                .build();
    }
}
