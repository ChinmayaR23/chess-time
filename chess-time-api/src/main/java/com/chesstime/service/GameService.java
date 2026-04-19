package com.chesstime.service;

import com.chesstime.dto.GameMessage;
import com.chesstime.model.*;
import com.chesstime.repository.GameRepository;
import com.chesstime.repository.MoveRepository;
import com.chesstime.repository.RatingHistoryRepository;
import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.Square;
import com.github.bhlangonijr.chesslib.move.Move;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GameService {

    private final GameRepository gameRepository;
    private final MoveRepository moveRepository;
    private final RatingHistoryRepository ratingHistoryRepository;
    private final EloService eloService;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    private static final long ABANDON_TIMEOUT_MS = 60_000;

    // In-memory active game state
    public static class ActiveGame {
        public final String gameId;
        public final Board board = new Board();
        public String whiteSessionId;
        public String blackSessionId;
        public final String whiteGuestId;
        public final String blackGuestId;
        public final String whiteUserId;
        public final String blackUserId;
        public final String whiteName;
        public final String blackName;
        public final int whiteRatingSnapshot;
        public final int blackRatingSnapshot;
        public long whiteTimeLeft; // ms
        public long blackTimeLeft; // ms
        public long lastTickAt;
        public String drawOfferedBy; // "white" | "black" | null
        public final List<GameMessage.MoveRecord> moves = new ArrayList<>();
        public final Map<String, ScheduledFuture<?>> abandonTimers = new ConcurrentHashMap<>();

        public ActiveGame(String gameId, String whiteSessionId, String blackSessionId,
                          String whiteGuestId, String blackGuestId,
                          String whiteUserId, String blackUserId,
                          String whiteName, String blackName,
                          int whiteRating, int blackRating, int timeControlSec) {
            this.gameId = gameId;
            this.whiteSessionId = whiteSessionId;
            this.blackSessionId = blackSessionId;
            this.whiteGuestId = whiteGuestId;
            this.blackGuestId = blackGuestId;
            this.whiteUserId = whiteUserId;
            this.blackUserId = blackUserId;
            this.whiteName = whiteName;
            this.blackName = blackName;
            this.whiteRatingSnapshot = whiteRating;
            this.blackRatingSnapshot = blackRating;
            this.whiteTimeLeft = timeControlSec * 1000L;
            this.blackTimeLeft = timeControlSec * 1000L;
            this.lastTickAt = System.currentTimeMillis();
        }
    }

    private final Map<String, ActiveGame> activeGames = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    public void createActiveGame(com.chesstime.model.Game dbGame,
                                  String whiteSessionId, String blackSessionId) {
        ActiveGame ag = new ActiveGame(
                dbGame.getId(), whiteSessionId, blackSessionId,
                dbGame.getWhiteGuestId(), dbGame.getBlackGuestId(),
                dbGame.getWhitePlayerId(), dbGame.getBlackPlayerId(),
                dbGame.getWhiteName(), dbGame.getBlackName(),
                dbGame.getWhiteRating(), dbGame.getBlackRating(),
                dbGame.getTimeControl()
        );
        activeGames.put(dbGame.getId(), ag);
        log.info("Game started: {}", dbGame.getId());
    }

    @Scheduled(fixedRate = 100)
    public void tickClocks() {
        long now = System.currentTimeMillis();
        for (ActiveGame ag : activeGames.values()) {
            long elapsed = now - ag.lastTickAt;
            ag.lastTickAt = now;

            boolean whiteTurn = ag.board.getSideToMove().value().equals("WHITE");
            if (whiteTurn) {
                ag.whiteTimeLeft = Math.max(0, ag.whiteTimeLeft - elapsed);
                if (ag.whiteTimeLeft == 0) finalizeGame(ag, GameResult.BLACK_WINS, "black");
            } else {
                ag.blackTimeLeft = Math.max(0, ag.blackTimeLeft - elapsed);
                if (ag.blackTimeLeft == 0) finalizeGame(ag, GameResult.WHITE_WINS, "white");
            }
        }
    }

    public ActiveGame getActiveGame(String gameId) {
        return activeGames.get(gameId);
    }

    public ActiveGame getGameBySessionId(String sessionId) {
        return activeGames.values().stream()
                .filter(ag -> ag.whiteSessionId.equals(sessionId) || ag.blackSessionId.equals(sessionId))
                .findFirst()
                .orElse(null);
    }

    public String getColorBySessionId(ActiveGame ag, String sessionId) {
        if (ag.whiteSessionId.equals(sessionId)) return "white";
        if (ag.blackSessionId.equals(sessionId)) return "black";
        return null;
    }

    /**
     * Apply a move. Returns the SAN string if valid, null if illegal.
     */
    public String applyMove(ActiveGame ag, String from, String to, String promotion) {
        try {
            Square fromSq = Square.fromValue(from.toUpperCase());
            Square toSq = Square.fromValue(to.toUpperCase());

            Move move;
            if (promotion != null && !promotion.isEmpty()) {
                com.github.bhlangonijr.chesslib.Piece promotionPiece = switch (promotion.toLowerCase()) {
                    case "q" -> ag.board.getSideToMove() == com.github.bhlangonijr.chesslib.Side.WHITE
                            ? com.github.bhlangonijr.chesslib.Piece.WHITE_QUEEN
                            : com.github.bhlangonijr.chesslib.Piece.BLACK_QUEEN;
                    case "r" -> ag.board.getSideToMove() == com.github.bhlangonijr.chesslib.Side.WHITE
                            ? com.github.bhlangonijr.chesslib.Piece.WHITE_ROOK
                            : com.github.bhlangonijr.chesslib.Piece.BLACK_ROOK;
                    case "b" -> ag.board.getSideToMove() == com.github.bhlangonijr.chesslib.Side.WHITE
                            ? com.github.bhlangonijr.chesslib.Piece.WHITE_BISHOP
                            : com.github.bhlangonijr.chesslib.Piece.BLACK_BISHOP;
                    default -> ag.board.getSideToMove() == com.github.bhlangonijr.chesslib.Side.WHITE
                            ? com.github.bhlangonijr.chesslib.Piece.WHITE_KNIGHT
                            : com.github.bhlangonijr.chesslib.Piece.BLACK_KNIGHT;
                };
                move = new Move(fromSq, toSq, promotionPiece);
            } else {
                move = new Move(fromSq, toSq);
            }

            // Validate move is in legal moves list
            var legalMoves = ag.board.legalMoves();
            boolean isLegal = legalMoves.stream().anyMatch(m -> m.equals(move));
            if (!isLegal) return null;

            String san = move.toString(); // chesslib uses SAN-like notation
            ag.board.doMove(move);
            ag.lastTickAt = System.currentTimeMillis();

            String fen = ag.board.getFen();
            String uci = from.toLowerCase() + to.toLowerCase() + (promotion != null ? promotion.toLowerCase() : "");

            GameMessage.MoveRecord record = new GameMessage.MoveRecord();
            record.setMoveIndex(ag.moves.size());
            record.setSan(san);
            record.setUci(uci);
            record.setFen(fen);
            ag.moves.add(record);

            // Persist move async
            scheduler.execute(() -> {
                gameRepository.findById(ag.gameId).ifPresent(dbGame -> {
                    com.chesstime.model.Move dbMove = new com.chesstime.model.Move();
                    dbMove.setGame(dbGame);
                    dbMove.setMoveIndex(record.getMoveIndex());
                    dbMove.setSan(san);
                    dbMove.setUci(uci);
                    dbMove.setFen(fen);
                    moveRepository.save(dbMove);
                });
            });

            // Check game-over conditions
            if (ag.board.isMated()) {
                String winner = ag.board.getSideToMove().value().equals("WHITE") ? "black" : "white";
                finalizeGame(ag, winner.equals("white") ? GameResult.WHITE_WINS : GameResult.BLACK_WINS, winner);
            } else if (ag.board.isDraw() || ag.board.isStaleMate()) {
                finalizeGame(ag, GameResult.DRAW, null);
            }

            return san;
        } catch (Exception e) {
            log.warn("Illegal move {}{}: {}", from, to, e.getMessage());
            return null;
        }
    }

    public void finalizeGame(ActiveGame ag, GameResult result, String winner) {
        if (!activeGames.containsKey(ag.gameId)) return; // already finalized
        activeGames.remove(ag.gameId);

        // Cancel abandon timers
        ag.abandonTimers.values().forEach(t -> t.cancel(false));
        ag.abandonTimers.clear();

        // Elo
        int whiteDelta = 0, blackDelta = 0;
        if (result != GameResult.ABORTED) {
            String gameResultStr = winner == null ? "draw" : winner;
            try {
                int whiteGamesPlayed = ag.whiteUserId != null ? userService.findById(ag.whiteUserId).getGamesPlayed() : 0;
                int blackGamesPlayed = ag.blackUserId != null ? userService.findById(ag.blackUserId).getGamesPlayed() : 0;

                EloService.RatingResult elo = eloService.calculate(
                        ag.whiteRatingSnapshot, ag.blackRatingSnapshot,
                        whiteGamesPlayed, blackGamesPlayed,
                        gameResultStr);
                whiteDelta = elo.whiteDelta();
                blackDelta = elo.blackDelta();

                if (ag.whiteUserId != null) {
                    userService.updateRating(ag.whiteUserId, elo.newWhiteRating(),
                            result == GameResult.WHITE_WINS ? "win" : result == GameResult.BLACK_WINS ? "loss" : "draw");
                    saveRatingHistory(ag.whiteUserId, ag.gameId, ag.whiteRatingSnapshot, elo.newWhiteRating(), elo.whiteDelta());
                }
                if (ag.blackUserId != null) {
                    userService.updateRating(ag.blackUserId, elo.newBlackRating(),
                            result == GameResult.BLACK_WINS ? "win" : result == GameResult.WHITE_WINS ? "loss" : "draw");
                    saveRatingHistory(ag.blackUserId, ag.gameId, ag.blackRatingSnapshot, elo.newBlackRating(), elo.blackDelta());
                }
            } catch (Exception e) {
                log.error("Error updating ratings for game {}: {}", ag.gameId, e.getMessage());
            }
        }

        final int finalWhiteDelta = whiteDelta;
        final int finalBlackDelta = blackDelta;

        // Persist game
        scheduler.execute(() -> gameRepository.findById(ag.gameId).ifPresent(dbGame -> {
            dbGame.setStatus(GameStatus.FINISHED);
            dbGame.setResult(result);
            dbGame.setWinner(winner);
            dbGame.setFen(ag.board.getFen());
            dbGame.setEndedAt(LocalDateTime.now());
            gameRepository.save(dbGame);
        }));

        // Broadcast game over
        Map<String, Integer> ratingDelta = result != GameResult.ABORTED
                ? Map.of("white", finalWhiteDelta, "black", finalBlackDelta)
                : null;
        messagingTemplate.convertAndSend("/topic/game/" + ag.gameId,
                GameMessage.over(result, winner, ratingDelta));
    }

    private void saveRatingHistory(String userId, String gameId, int before, int after, int delta) {
        RatingHistory rh = new RatingHistory();
        rh.setUserId(userId);
        rh.setGameId(gameId);
        rh.setRatingBefore(before);
        rh.setRatingAfter(after);
        rh.setDelta(delta);
        ratingHistoryRepository.save(rh);
    }

    public void handleDisconnect(String sessionId) {
        ActiveGame ag = getGameBySessionId(sessionId);
        if (ag == null) return;

        String color = getColorBySessionId(ag, sessionId);
        if (color == null) return;

        String key = color.equals("white") ? ag.whiteGuestId : ag.blackGuestId;
        ScheduledFuture<?> timer = scheduler.schedule(() -> {
            GameResult result = color.equals("white") ? GameResult.BLACK_WINS : GameResult.WHITE_WINS;
            String winner = color.equals("white") ? "black" : "white";
            finalizeGame(ag, result, winner);
        }, ABANDON_TIMEOUT_MS, TimeUnit.MILLISECONDS);

        ag.abandonTimers.put(key, timer);
    }

    public void cancelAbandonTimer(ActiveGame ag, String guestId) {
        ScheduledFuture<?> timer = ag.abandonTimers.remove(guestId);
        if (timer != null) timer.cancel(false);
    }
}
