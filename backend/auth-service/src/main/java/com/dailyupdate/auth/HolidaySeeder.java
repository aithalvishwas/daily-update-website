package com.dailyupdate.auth;

import com.dailyupdate.common.TenantContext;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Loads the starter list of India office holidays (holidays-india.csv) once per workspace. After
 * that the workspace's admin owns the list, so holidays they delete don't come back on the next restart.
 */
@Component
@Order(1)
public class HolidaySeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(HolidaySeeder.class);
    private static final String SEEDED = "holidays_seeded";

    private final WorkplaceRepository workplace;

    public HolidaySeeder(WorkplaceRepository workplace) {
        this.workplace = workplace;
    }

    /** The workspace from before workspaces existed. New workspaces are seeded when they sign up. */
    @Override
    public void run(ApplicationArguments args) {
        TenantContext.run(1, this::seed);
    }

    /** Seeds the current workspace's holidays, unless that was done before. */
    public void seed() {
        if (workplace.setting(SEEDED).isPresent()) {
            return;
        }
        int count = 0;
        var resource = new ClassPathResource("holidays-india.csv");
        try (var reader = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank() || line.startsWith("#")) {
                    continue;
                }
                // date,offices,name  where offices is "All" or a list like "Mumbai Pune".
                String[] parts = line.split(",", 3);
                LocalDate day = LocalDate.parse(parts[0].trim());
                String name = parts[2].trim();
                if ("All".equals(parts[1].trim())) {
                    workplace.insertHolidayIfMissing(null, day, name);
                    count++;
                } else {
                    for (String city : parts[1].trim().split("\\s+")) {
                        workplace.insertHolidayIfMissing(Workplace.office(city), day, name);
                        count++;
                    }
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        if (workplace.addSettingIfMissing(SEEDED, "true")) {
            log.info("Seeded {} office holidays", count);
        }
    }
}
