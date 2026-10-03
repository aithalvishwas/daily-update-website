package com.dailyupdate.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

final class Requests {

    private Requests() {}

    record Register(
            @NotBlank(message = "Name is required (max 100 characters)")
            @Size(max = 100, message = "Name is required (max 100 characters)") String name,
            @NotBlank(message = "A valid email is required")
            @Email(message = "A valid email is required")
            @Size(max = 255, message = "A valid email is required") String email,
            @NotBlank(message = "Password must be 8 to 128 characters")
            @Size(min = 8, max = 128, message = "Password must be 8 to 128 characters") String password,
            @Size(max = 100, message = "Team must be at most 100 characters") String team,
            @Size(max = 100, message = "Position must be at most 100 characters") String position) {}

    record CreateUser(
            @NotBlank(message = "Name is required (max 100 characters)")
            @Size(max = 100, message = "Name is required (max 100 characters)") String name,
            @NotBlank(message = "A valid email is required")
            @Email(message = "A valid email is required")
            @Size(max = 255, message = "A valid email is required") String email,
            @NotBlank(message = "Password must be 8 to 128 characters")
            @Size(min = 8, max = 128, message = "Password must be 8 to 128 characters") String password,
            @Size(max = 100, message = "Team must be at most 100 characters") String team,
            @Size(max = 100, message = "Position must be at most 100 characters") String position,
            String role) {}

    record UpdateUser(
            @Size(max = 100, message = "Team must be at most 100 characters") String team,
            @Size(max = 100, message = "Position must be at most 100 characters") String position,
            String role) {}

    record AdminUpdate(
            @Size(max = 100, message = "Name must be at most 100 characters") String name,
            @Email(message = "A valid email is required")
            @Size(max = 255, message = "A valid email is required") String email,
            @Size(max = 100, message = "Team must be at most 100 characters") String team,
            @Size(max = 100, message = "Position must be at most 100 characters") String position,
            String role) {}

    record ResetPassword(
            @NotBlank(message = "Password must be 8 to 128 characters")
            @Size(min = 8, max = 128, message = "Password must be 8 to 128 characters") String password) {}

    record CreateTeam(
            @NotBlank(message = "Team name is required")
            @Size(max = 100, message = "Team name must be at most 100 characters") String name) {}

    record Login(String email, String password) {}
}
