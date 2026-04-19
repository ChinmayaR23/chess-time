package com.chesstime.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "rating_history")
@Data
@NoArgsConstructor
public class RatingHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String gameId;

    private int ratingBefore;
    private int ratingAfter;
    private int delta;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
