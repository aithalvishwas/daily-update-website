package com.dailyupdate.worklog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.dailyupdate")
public class WorklogApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorklogApplication.class, args);
    }
}
