package com.dailyupdate.common;

/** The signed-in user, taken from a verified login token. {@code companyId} is their workspace. */
public record AuthUser(long id, String role, String name, long companyId) {

    public static final String EMPLOYEE = "employee";
    public static final String MANAGER = "manager";
    public static final String ADMIN = "admin";

    /** Admins can do everything a manager can, plus manage accounts. */
    public boolean isManager() {
        return MANAGER.equals(role) || ADMIN.equals(role);
    }

    public boolean isAdmin() {
        return ADMIN.equals(role);
    }
}
