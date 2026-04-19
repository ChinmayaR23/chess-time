package com.chesstime.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "moves", indexes = @Index(columnList = "game_id, moveIndex"))
@Data
@NoArgsConstructor
public class Move {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    private int moveIndex;
    private String san;  // Standard Algebraic Notation e.g. "e4"
    private String uci;  // UCI format e.g. "e2e4"

    @Column(columnDefinition = "TEXT")
    private String fen;  // FEN after this move

    @CreationTimestamp
    private LocalDateTime timestamp;
}
