package com.dailyupdate.common;

import java.util.function.Supplier;

/**
 * The company (workspace) the current request works in. Every database connection taken while it
 * is set only sees that company's rows (see {@link TenantDatabase}).
 */
public final class TenantContext {

    private static final ThreadLocal<Long> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    /** The current company, or null outside a signed-in request. */
    public static Long current() {
        return CURRENT.get();
    }

    static void set(Long companyId) {
        if (companyId == null) {
            CURRENT.remove();
        } else {
            CURRENT.set(companyId);
        }
    }

    /** Runs {@code work} inside one company, for sign-in, sign-up and startup seeding. */
    public static <T> T call(long companyId, Supplier<T> work) {
        Long previous = CURRENT.get();
        CURRENT.set(companyId);
        try {
            return work.get();
        } finally {
            set(previous);
        }
    }

    public static void run(long companyId, Runnable work) {
        call(companyId, () -> {
            work.run();
            return null;
        });
    }
}
