package com.chesstime.controller;

import com.chesstime.model.Game;
import com.chesstime.repository.GameRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameRestController {

    private final GameRepository gameRepository;

    @GetMapping("/{gameId}")
    public ResponseEntity<Game> getGame(@PathVariable String gameId) {
        return gameRepository.findById(gameId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
