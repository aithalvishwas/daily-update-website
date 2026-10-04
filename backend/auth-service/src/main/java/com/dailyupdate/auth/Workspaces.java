package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Works out which workspace a request is for from its address: {@code google.workpulselens.com}
 * is the "google" workspace, and {@code workpulselens.com} itself is the public site, where
 * companies sign up but nobody logs in.
 */
@Component
public class Workspaces {

    private static final Pattern SLUG = Pattern.compile("[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?");

    /** Addresses a company can't take. */
    private static final Set<String> RESERVED = Set.of("www", "api", "admin", "app", "apps", "mail", "email",
            "smtp", "imap", "pop", "ftp", "ns1", "ns2", "help", "support", "status", "blog", "docs", "dev",
            "staging", "test", "demo", "static", "assets", "cdn", "login", "signin", "signup", "register", "auth",
            "account", "accounts", "dashboard", "billing", "root", "workpulselens");

    private final String rootDomain;
    private final CompanyRepository companies;

    public Workspaces(@Value("${app.root-domain}") String rootDomain, CompanyRepository companies) {
        this.rootDomain = rootDomain.trim().toLowerCase(Locale.ROOT);
        this.companies = companies;
    }

    public String rootDomain() {
        return rootDomain;
    }

    /** The workspace address in a host name, or empty for the public site (or a host that isn't ours). */
    public Optional<String> slugOf(String host) {
        if (host == null) {
            return Optional.empty();
        }
        String h = host.trim().toLowerCase(Locale.ROOT);
        int colon = h.indexOf(':');
        if (colon >= 0) {
            h = h.substring(0, colon);
        }
        if (h.endsWith(".")) {
            h = h.substring(0, h.length() - 1);
        }
        String suffix = "." + rootDomain;
        if (!h.endsWith(suffix)) {
            return Optional.empty();
        }
        String slug = h.substring(0, h.length() - suffix.length());
        return slug.equals("www") || slug.contains(".") ? Optional.empty() : Optional.of(slug);
    }

    public Optional<String> slugOf(HttpServletRequest request) {
        return slugOf(request.getServerName());
    }

    /** The company whose address this request came to; fails on the public site or an unknown address. */
    public Company require(HttpServletRequest request) {
        String slug = slugOf(request).orElseThrow(() -> new ApiException(400,
                "Open your company's workspace address (yourcompany." + rootDomain + ") to sign in"));
        return companies.findBySlug(slug)
                .orElseThrow(() -> new ApiException(404, "There is no workspace at " + slug + "." + rootDomain));
    }

    public Optional<Company> find(String slug) {
        return companies.findBySlug(slug);
    }

    /** Checks a requested address and returns it cleaned up. */
    public String validSlug(String raw) {
        String slug = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (slug.length() < 2 || !SLUG.matcher(slug).matches()) {
            throw new ApiException(400,
                    "Workspace address must be 2 to 40 letters, numbers or dashes, and can't start or end with a dash");
        }
        if (RESERVED.contains(slug)) {
            throw new ApiException(409, "That workspace address is taken");
        }
        return slug;
    }
}
