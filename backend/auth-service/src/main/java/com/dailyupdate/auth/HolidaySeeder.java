package com.dailyupdate.auth;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Loads the starter list of India office holidays (holidays-india.csv) once. After that the admin
 * owns the list, so holidays they delete don't come back on the next restart.
 */
@Component
public class HolidaySeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(HolidaySeeder.class);
    private static final String SEEDED = "holidays_seeded";

    private final WorkplaceRepository workplace;

    public HolidaySeeder(WorkplaceRepository workplace) {
        this.workplace = workplace;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
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
        }
        if (workplace.addSettingIfMissing(SEEDED, "true")) {
            log.info("Seeded {} office holidays", count);
        }
    }
}
