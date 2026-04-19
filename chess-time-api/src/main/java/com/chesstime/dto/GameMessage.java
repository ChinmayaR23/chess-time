package com.chesstime.dto;

import com.chesstime.model.GameResult;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Generic envelope broadcast to /topic/game/{gameId}.
 * Clients distinguish events by the "type" field.
 */
@Data
public class GameMessage {
    private String type; // "move" | "state" | "over" | "draw_offered" | "draw_declined" | "chat"

    // move
    private String from;
    private String to;
    private String promotion;
    private String san;
    private String fen;
    private int moveIndex;

    // state
    private List<MoveRecord> moves;
    private String turn;      // "w" or "b"
    private long whiteTimeLeft;
    private long blackTimeLeft;
    private String status;
    private PlayerInfo white;
    private PlayerInfo black;

    // over
    private GameResult result;
    private String winner;
    private Map<String, Integer> ratingDelta; // {"white": 10, "black": -10}

    // draw_offered
    private String by; // "white" | "black"

    // chat
    private String senderName;
    private String content;
    private String createdAt;

    @Data
    public static class MoveRecord {
        private int moveIndex;
        private String san;
        private String uci;
        private String fen;
    }

    @Data
    public static class PlayerInfo {
        private String id;
        private String name;
        private int rating;
        private boolean guest;
    }

    // Factory helpers
    public static GameMessage move(String from, String to, String promotion, String san, String fen, int moveIndex) {
        GameMessage m = new GameMessage();
        m.setType("move");
        m.setFrom(from);
        m.setTo(to);
        m.setPromotion(promotion);
        m.setSan(san);
        m.setFen(fen);
        m.setMoveIndex(moveIndex);
        return m;
    }

    public static GameMessage over(GameResult result, String winner, Map<String, Integer> ratingDelta) {
        GameMessage m = new GameMessage();
        m.setType("over");
        m.setResult(result);
        m.setWinner(winner);
        m.setRatingDelta(ratingDelta);
        return m;
    }

    public static GameMessage drawOffered(String by) {
        GameMessage m = new GameMessage();
        m.setType("draw_offered");
        m.setBy(by);
        return m;
    }

    public static GameMessage drawDeclined() {
        GameMessage m = new GameMessage();
        m.setType("draw_declined");
        return m;
    }

    public static GameMessage chat(String senderName, String content, String createdAt) {
        GameMessage m = new GameMessage();
        m.setType("chat");
        m.setSenderName(senderName);
        m.setContent(content);
        m.setCreatedAt(createdAt);
        return m;
    }
}
