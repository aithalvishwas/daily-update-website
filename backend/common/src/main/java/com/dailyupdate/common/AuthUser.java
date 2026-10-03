package com.dailyupdate.common;

/** The signed-in user, taken from a verified login token. */
public record AuthUser(long id, String role, String name) {

    public static final String EMPLOYEE = "employee";
    public static final String MANAGER = "manager";

    public boolean isManager() {
        return MANAGER.equals(role);
    }
}
