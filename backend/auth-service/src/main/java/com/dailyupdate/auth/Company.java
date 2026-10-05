package com.dailyupdate.auth;

/** A company's workspace, reached at {@code <slug>.<root domain>}. */
public record Company(long id, String slug, String name) {

    public Public toPublic() {
        return new Public(slug, name);
    }

    public record Public(String slug, String name) {}
}
