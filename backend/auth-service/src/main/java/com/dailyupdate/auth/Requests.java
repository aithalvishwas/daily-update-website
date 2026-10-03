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
            @Size(max = 100, message = "Team must be at most 100 characters") String team) {}

    record CreateUser(
            @NotBlank(message = "Name is required (max 100 characters)")
            @Size(max = 100, message = "Name is required (max 100 characters)") String name,
            @NotBlank(message = "A valid email is required")
            @Email(message = "A valid email is required")
            @Size(max = 255, message = "A valid email is required") String email,
            @NotBlank(message = "Password must be 8 to 128 characters")
            @Size(min = 8, max = 128, message = "Password must be 8 to 128 characters") String password,
            @Size(max = 100, message = "Team must be at most 100 characters") String team,
            String role) {}

    record Login(String email, String password) {}
}
