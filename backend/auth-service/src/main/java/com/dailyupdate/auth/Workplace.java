package com.dailyupdate.auth;

import com.dailyupdate.common.ApiException;
import java.util.List;

/** The offices people work from. Holidays are kept per office; India only for now. */
final class Workplace {

    static final List<String> OFFICES = List.of("Bengaluru", "Chennai", "Gurgaon", "Hyderabad", "Mumbai", "Pune");

    /** Feature flag: comp-off and overtime pay for weekend work. Off means all seven days are workdays. */
    static final String WEEKEND_REQUESTS = "weekend_requests";

    private Workplace() {}

    /** A known office name, or null for blank. */
    static String office(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return OFFICES.stream().filter(o -> o.equalsIgnoreCase(value.trim())).findFirst()
                .orElseThrow(() -> new ApiException(400, "Office must be one of " + String.join(", ", OFFICES)));
    }
}
