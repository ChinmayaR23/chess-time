package com.chesstime;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ChessTimeApplication {
    public static void main(String[] args) {
        SpringApplication.run(ChessTimeApplication.class, args);
    }
}
