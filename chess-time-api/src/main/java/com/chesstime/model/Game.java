package com.chesstime.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "games")
@Data
@NoArgsConstructor
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // Nullable — guests don't have a user record
    private String whitePlayerId;
    private String blackPlayerId;

    // Always set (guests get a UUID from the client)
    private String whiteGuestId;
    private String blackGuestId;

    private String whiteName;
    private String blackName;
    private int whiteRating;
    private int blackRating;

    @Column(columnDefinition = "TEXT")
    private String pgn = "";

    @Column(columnDefinition = "TEXT", nullable = false)
    private String fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameStatus status = GameStatus.WAITING;

    @Enumerated(EnumType.STRING)
    private GameResult result;

    private String winner; // "white" | "black" | null

    private int timeControl = 600; // seconds per side

    private Long whiteTimeLeft; // ms
    private Long blackTimeLeft; // ms

    private LocalDateTime startedAt;
    private LocalDateTime endedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "game", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Move> moves = new ArrayList<>();

    @OneToMany(mappedBy = "game", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ChatMessage> chatMessages = new ArrayList<>();
}
