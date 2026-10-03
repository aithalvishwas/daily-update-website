package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import java.util.Locale;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository users;
    private final TeamRepository teams;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, TeamRepository teams, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.teams = teams;
        this.passwordEncoder = passwordEncoder;
    }

    public User create(String name, String email, String password, String team, String position, String role) {
        String cleanTeam = blankToNull(team);
        if (cleanTeam != null) {
            teams.ensure(cleanTeam);
        }
        try {
            return users.insert(name.trim(), normalizeEmail(email), passwordEncoder.encode(password), role, cleanTeam,
                    blankToNull(position));
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "Email already registered");
        }
    }

    /** Moves someone to a team, changes their position, or promotes them. */
    public User update(long id, String team, String position, String role) {
        User current = users.findById(id).orElseThrow(() -> new ApiException(404, "User not found"));
        String cleanTeam = team == null ? current.team() : blankToNull(team);
        if (cleanTeam != null) {
            teams.ensure(cleanTeam);
        }
        String newRole = role == null ? current.role() : role;
        return users.update(id, cleanTeam, position == null ? current.position() : blankToNull(position), newRole);
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
