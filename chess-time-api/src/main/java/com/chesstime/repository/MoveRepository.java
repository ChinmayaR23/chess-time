package com.chesstime.repository;

import com.chesstime.model.Move;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MoveRepository extends JpaRepository<Move, String> {
    List<Move> findByGameIdOrderByMoveIndex(String gameId);
}
