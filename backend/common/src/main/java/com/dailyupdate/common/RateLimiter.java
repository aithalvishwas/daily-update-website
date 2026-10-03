package com.dailyupdate.common;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory fixed-window limiter: at most {@code limit} calls per key per window. */
public class RateLimiter {

    private record Window(long start, int count) {}

    private final int limit;
    private final long windowMillis;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimiter(int limit, Duration window) {
        this.limit = limit;
        this.windowMillis = window.toMillis();
    }

    /** Records a call for the key; returns false when the key is over its limit. */
    public boolean tryAcquire(String key) {
        long now = System.currentTimeMillis();
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(e -> now - e.getValue().start() >= windowMillis);
        }
        Window w = windows.compute(key, (k, old) ->
                old == null || now - old.start() >= windowMillis ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
        return w.count() <= limit;
    }

    public void check(String key, String message) {
        if (!tryAcquire(key)) {
            throw new ApiException(429, message);
        }
    }
}
