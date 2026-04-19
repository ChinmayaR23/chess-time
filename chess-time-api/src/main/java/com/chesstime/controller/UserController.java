package com.chesstime.controller;

import com.chesstime.model.Game;
import com.chesstime.model.GameStatus;
import com.chesstime.model.RatingHistory;
import com.chesstime.model.User;
import com.chesstime.repository.GameRepository;
import com.chesstime.repository.RatingHistoryRepository;
import com.chesstime.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final GameRepository gameRepository;
    private final RatingHistoryRepository ratingHistoryRepository;

    @GetMapping("/me")
    public ResponseEntity<User> getMe(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(userService.findById(userId));
    }

    @GetMapping("/games")
    public ResponseEntity<List<Map<String, Object>>> getGames(@AuthenticationPrincipal String userId) {
        List<Game> games = gameRepository
                .findByWhitePlayerIdOrBlackPlayerIdAndStatusOrderByCreatedAtDesc(
                        userId, userId, GameStatus.FINISHED);

        List<RatingHistory> history = ratingHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        Map<String, RatingHistory> historyByGame = new java.util.HashMap<>();
        history.forEach(rh -> historyByGame.put(rh.getGameId(), rh));

        List<Map<String, Object>> result = games.stream().map(g -> {
            Map<String, Object> entry = new java.util.LinkedHashMap<>();
            entry.put("id", g.getId());
            entry.put("result", g.getResult());
            entry.put("winner", g.getWinner());
            entry.put("timeControl", g.getTimeControl());
            entry.put("endedAt", g.getEndedAt());
            entry.put("myColor", g.getWhitePlayerId() != null && g.getWhitePlayerId().equals(userId) ? "white" : "black");
            entry.put("whiteName", g.getWhiteName());
            entry.put("blackName", g.getBlackName());
            entry.put("whiteRating", g.getWhiteRating());
            entry.put("blackRating", g.getBlackRating());
            RatingHistory rh = historyByGame.get(g.getId());
            if (rh != null) entry.put("ratingChange", Map.of(
                    "ratingBefore", rh.getRatingBefore(),
                    "ratingAfter", rh.getRatingAfter(),
                    "delta", rh.getDelta()
            ));
            return entry;
        }).toList();

        return ResponseEntity.ok(result);
    }
}
