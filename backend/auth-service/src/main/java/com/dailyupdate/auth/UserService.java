package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import java.util.Locale;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public User create(String name, String email, String password, String team, String role) {
        String cleanTeam = team == null || team.isBlank() ? null : team.trim();
        try {
            return users.insert(name.trim(), normalizeEmail(email), passwordEncoder.encode(password), role, cleanTeam);
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "Email already registered");
        }
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
