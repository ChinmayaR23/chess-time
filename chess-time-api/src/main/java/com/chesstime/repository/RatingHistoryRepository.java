package com.chesstime.repository;

import com.chesstime.model.RatingHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RatingHistoryRepository extends JpaRepository<RatingHistory, String> {
    List<RatingHistory> findByUserIdOrderByCreatedAtDesc(String userId);
}
