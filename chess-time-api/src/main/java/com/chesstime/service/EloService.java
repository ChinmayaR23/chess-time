package com.chesstime.service;

import org.springframework.stereotype.Service;

@Service
public class EloService {

    public int getKFactor(int rating, int gamesPlayed) {
        if (gamesPlayed < 30) return 40;
        if (rating >= 2400) return 10;
        return 20;
    }

    public double expectedScore(int ratingA, int ratingB) {
        return 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400.0));
    }

    public record RatingResult(int newWhiteRating, int newBlackRating, int whiteDelta, int blackDelta) {}

    public RatingResult calculate(int whiteRating, int blackRating,
                                  int whiteGamesPlayed, int blackGamesPlayed,
                                  String result) {
        int kWhite = getKFactor(whiteRating, whiteGamesPlayed);
        int kBlack = getKFactor(blackRating, blackGamesPlayed);

        double expectedWhite = expectedScore(whiteRating, blackRating);
        double expectedBlack = expectedScore(blackRating, whiteRating);

        double whiteScore = switch (result) {
            case "white" -> 1.0;
            case "black" -> 0.0;
            default -> 0.5;
        };
        double blackScore = 1.0 - whiteScore;

        int whiteDelta = (int) Math.round(kWhite * (whiteScore - expectedWhite));
        int blackDelta = (int) Math.round(kBlack * (blackScore - expectedBlack));

        return new RatingResult(
                Math.max(100, whiteRating + whiteDelta),
                Math.max(100, blackRating + blackDelta),
                whiteDelta,
                blackDelta
        );
    }
}
