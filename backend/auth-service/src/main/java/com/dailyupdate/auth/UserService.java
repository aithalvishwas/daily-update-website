package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import com.dailyupdate.common.AuthUser;
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
        return create(name, email, password, team, position, null, role);
    }

    public User create(String name, String email, String password, String team, String position, String office,
            String role) {
        String cleanOffice = Workplace.office(office);
        String cleanTeam = blankToNull(team);
        if (cleanTeam != null) {
            teams.ensure(cleanTeam);
        }
        try {
            return users.insert(name.trim(), normalizeEmail(email), passwordEncoder.encode(password), role, cleanTeam,
                    blankToNull(position), cleanOffice);
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

    /** Admins: change anything about an account, including the login email. */
    public User updateAccount(long id, String name, String email, String team, String position, String office,
            String role) {
        User current = users.findById(id).orElseThrow(() -> new ApiException(404, "User not found"));
        String cleanTeam = team == null ? current.team() : blankToNull(team);
        if (cleanTeam != null) {
            teams.ensure(cleanTeam);
        }
        String newRole = role == null ? current.role() : role;
        if (AuthUser.ADMIN.equals(current.role()) && !AuthUser.ADMIN.equals(newRole) && current.active()
                && users.activeAdmins() <= 1) {
            throw new ApiException(409, "Keep at least one active admin");
        }
        try {
            return users.updateAccount(id,
                    name == null || name.isBlank() ? current.name() : name.trim(),
                    email == null || email.isBlank() ? current.email() : normalizeEmail(email),
                    cleanTeam,
                    position == null ? current.position() : blankToNull(position),
                    office == null ? current.office() : Workplace.office(office),
                    newRole);
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "Another account already uses that email");
        }
    }

    public void resetPassword(long id, String password) {
        users.findById(id).orElseThrow(() -> new ApiException(404, "User not found"));
        users.setPassword(id, passwordEncoder.encode(password));
    }

    /** Deactivated people can't log in; their updates, issues and history stay. */
    public User setActive(long id, boolean active) {
        User current = users.findById(id).orElseThrow(() -> new ApiException(404, "User not found"));
        if (!active && AuthUser.ADMIN.equals(current.role()) && current.active() && users.activeAdmins() <= 1) {
            throw new ApiException(409, "Keep at least one active admin");
        }
        return users.setActive(id, active);
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
