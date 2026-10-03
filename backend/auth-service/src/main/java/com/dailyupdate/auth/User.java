package com.dailyupdate.auth;

/** A user row. {@code passwordHash} never leaves this service. */
public record User(long id, String name, String email, String passwordHash, String role, String team) {

    public PublicUser toPublic() {
        return new PublicUser(id, name, email, role, team);
    }

    public record PublicUser(long id, String name, String email, String role, String team) {}
}
