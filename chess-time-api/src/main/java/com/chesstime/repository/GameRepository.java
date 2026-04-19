package com.chesstime.repository;

import com.chesstime.model.Game;
import com.chesstime.model.GameStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameRepository extends JpaRepository<Game, String> {
    List<Game> findByWhitePlayerIdOrBlackPlayerIdAndStatusOrderByCreatedAtDesc(
            String whitePlayerId, String blackPlayerId, GameStatus status);
}
