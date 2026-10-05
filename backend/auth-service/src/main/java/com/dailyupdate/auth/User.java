package com.dailyupdate.auth;

/** A user row. {@code passwordHash} never leaves this service. */
public record User(long id, String name, String email, String passwordHash, String role, String team,
        String position, String office, boolean active, boolean invitePending) {

    public PublicUser toPublic() {
        return new PublicUser(id, name, email, role, team, position, office, active, invitePending);
    }

    /** {@code invitePending}: added by an admin and hasn't set a password yet. */
    public record PublicUser(long id, String name, String email, String role, String team, String position,
            String office, boolean active, boolean invitePending) {}
}
