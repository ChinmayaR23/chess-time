package com.chesstime.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String name;

    @Column(unique = true)
    private String email;

    private String image;

    @Column(nullable = false)
    private String provider; // "github" or "google"

    @Column(nullable = false)
    private String providerId;

    @Column(nullable = false)
    private int rating = 1200;

    private int gamesPlayed = 0;
    private int gamesWon = 0;
    private int gamesLost = 0;
    private int gamesDrawn = 0;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
