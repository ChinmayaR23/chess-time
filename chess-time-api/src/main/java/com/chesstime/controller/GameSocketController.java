package com.chesstime.controller;

import com.chesstime.dto.*;
import com.chesstime.model.Game;
import com.chesstime.model.GameResult;
import com.chesstime.model.GameStatus;
import com.chesstime.model.User;
import com.chesstime.repository.GameRepository;
import com.chesstime.service.FriendshipService;
import com.chesstime.service.GameService;
import com.chesstime.service.GameService.ActiveGame;
import com.chesstime.service.MatchmakingService;
import com.chesstime.service.MatchmakingService.MatchedPair;
import com.chesstime.service.MatchmakingService.QueueEntry;
import com.chesstime.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Controller
@RequiredArgsConstructor
@Slf4j
public class GameSocketController {

    private final MatchmakingService matchmaking;
    private final GameService gameService;
    private final GameRepository gameRepository;
    private final SimpMessagingTemplate messaging;
    private final FriendshipService friendshipService;
    private final UserService userService;

    // In-memory pending game invites (friend → friend)
    private static class PendingInvite {
        String inviteId;
        String fromSessionId;
        String fromUserId;
        String fromName;
        int fromRating;
        String toUserId;
        int timeControl;
        long expiresAt;
    }
    private final Map<String, PendingInvite> pendingInvites = new ConcurrentHashMap<>();

    // Matchmaking tick — runs every 2 seconds
    @Scheduled(fixedRate = 2000)
    public void matchmakingTick() {
        List<MatchedPair> pairs = matchmaking.findMatches();
        for (MatchedPair pair : pairs) {
            try {
                QueueEntry white = pair.whiteGuestId().equals(pair.a().guestId()) ? pair.a() : pair.b();
                QueueEntry black = pair.whiteGuestId().equals(pair.a().guestId()) ? pair.b() : pair.a();

                Game dbGame = new Game();
                dbGame.setWhitePlayerId(white.userId());
                dbGame.setBlackPlayerId(black.userId());
                dbGame.setWhiteGuestId(pair.whiteGuestId());
                dbGame.setBlackGuestId(pair.blackGuestId());
                dbGame.setWhiteName(white.name());
                dbGame.setBlackName(black.name());
                dbGame.setWhiteRating(white.rating());
                dbGame.setBlackRating(black.rating());
                dbGame.setTimeControl(pair.a().timeControl());
                dbGame.setWhiteTimeLeft((long) pair.a().timeControl() * 1000);
                dbGame.setBlackTimeLeft((long) pair.a().timeControl() * 1000);
                dbGame.setStatus(GameStatus.ACTIVE);
                dbGame.setStartedAt(LocalDateTime.now());
                dbGame = gameRepository.save(dbGame);

                gameService.createActiveGame(dbGame, white.sessionId(), black.sessionId());

                // Notify white player
                GameMessage whiteMsg = new GameMessage();
                whiteMsg.setType("matched");
                messaging.convertAndSendToUser(white.sessionId(), "/queue/matched",
                        Map.of("gameId", dbGame.getId(), "color", "white",
                                "opponent", Map.of("name", black.name(), "rating", black.rating()),
                                "timeControl", pair.a().timeControl()));

                // Notify black player
                messaging.convertAndSendToUser(black.sessionId(), "/queue/matched",
                        Map.of("gameId", dbGame.getId(), "color", "black",
                                "opponent", Map.of("name", white.name(), "rating", white.rating()),
                                "timeControl", pair.a().timeControl()));

            } catch (Exception e) {
                log.error("Error creating matched game: {}", e.getMessage());
            }
        }
    }

    @MessageMapping("/queue/join")
    public void queueJoin(@Payload QueueJoinPayload payload, SimpMessageHeaderAccessor headers) {
        String sessionId = headers.getSessionId();
        QueueEntry entry = new QueueEntry(
                sessionId,
                payload.getUserId(),
                payload.getGuestId(),
                payload.getName(),
                payload.getRating(),
                payload.getTimeControl(),
                System.currentTimeMillis()
        );
        matchmaking.add(entry);
    }

    @MessageMapping("/queue/leave")
    public void queueLeave(@Payload Map<String, String> payload) {
        matchmaking.remove(payload.get("guestId"));
    }

    @MessageMapping("/game/request-state")
    public void requestState(@Payload Map<String, String> payload, SimpMessageHeaderAccessor headers) {
        String gameId = payload.get("gameId");
        String guestId = payload.get("guestId");
        ActiveGame ag = gameService.getActiveGame(gameId);
        if (ag == null) return;

        // Cancel any abandon timer for reconnecting player
        gameService.cancelAbandonTimer(ag, guestId);

        // Re-register session id (in case it changed on reconnect)
        String sessionId = headers.getSessionId();
        if (ag.whiteGuestId.equals(guestId)) ag.whiteSessionId = sessionId;
        else if (ag.blackGuestId.equals(guestId)) ag.blackSessionId = sessionId;

        // Send full state to the requesting user only
        GameMessage state = buildStateMessage(ag);
        messaging.convertAndSendToUser(sessionId, "/queue/game-state", state);
    }

    @MessageMapping("/game/move")
    public void gameMove(@Payload MovePayload payload, SimpMessageHeaderAccessor headers) {
        String sessionId = headers.getSessionId();
        ActiveGame ag = gameService.getActiveGame(payload.getGameId());
        if (ag == null) return;

        String color = gameService.getColorBySessionId(ag, sessionId);
        if (color == null) return;

        boolean whiteTurn = ag.board.getSideToMove().value().equals("WHITE");
        if ((color.equals("white") && !whiteTurn) || (color.equals("black") && whiteTurn)) {
            messaging.convertAndSendToUser(sessionId, "/queue/error",
                    Map.of("code", "NOT_YOUR_TURN", "message", "It is not your turn."));
            return;
        }

        String san = gameService.applyMove(ag, payload.getFrom(), payload.getTo(), payload.getPromotion());
        if (san == null) {
            // Send corrective state to client only
            messaging.convertAndSendToUser(sessionId, "/queue/error",
                    Map.of("code", "ILLEGAL_MOVE", "message", "Illegal move."));
            messaging.convertAndSendToUser(sessionId, "/queue/game-state", buildStateMessage(ag));
            return;
        }

        ag.drawOfferedBy = null;

        GameMessage.MoveRecord last = ag.moves.get(ag.moves.size() - 1);
        messaging.convertAndSend("/topic/game/" + payload.getGameId(),
                GameMessage.move(payload.getFrom(), payload.getTo(), payload.getPromotion(),
                        san, last.getFen(), last.getMoveIndex()));
    }

    @MessageMapping("/game/resign")
    public void resign(@Payload Map<String, String> payload, SimpMessageHeaderAccessor headers) {
        String sessionId = headers.getSessionId();
        String gameId = payload.get("gameId");
        String color = payload.get("color");

        ActiveGame ag = gameService.getActiveGame(gameId);
        if (ag == null) return;
        if (!color.equals(gameService.getColorBySessionId(ag, sessionId))) return;

        GameResult result = color.equals("white") ? GameResult.BLACK_WINS : GameResult.WHITE_WINS;
        String winner = color.equals("white") ? "black" : "white";
        gameService.finalizeGame(ag, result, winner);
    }

    @MessageMapping("/game/offer-draw")
    public void offerDraw(@Payload Map<String, String> payload, SimpMessageHeaderAccessor headers) {
        String sessionId = headers.getSessionId();
        String gameId = payload.get("gameId");
        String color = payload.get("color");

        ActiveGame ag = gameService.getActiveGame(gameId);
        if (ag == null) return;
        if (!color.equals(gameService.getColorBySessionId(ag, sessionId))) return;

        ag.drawOfferedBy = color;
        messaging.convertAndSend("/topic/game/" + gameId, GameMessage.drawOffered(color));
    }

    @MessageMapping("/game/accept-draw")
    public void acceptDraw(@Payload Map<String, String> payload, SimpMessageHeaderAccessor headers) {
        String sessionId = headers.getSessionId();
        String gameId = payload.get("gameId");

        ActiveGame ag = gameService.getActiveGame(gameId);
        if (ag == null || ag.drawOfferedBy == null) return;

        String myColor = gameService.getColorBySessionId(ag, sessionId);
        if (myColor == null || myColor.equals(ag.drawOfferedBy)) return;

        gameService.finalizeGame(ag, GameResult.DRAW, null);
    }

    @MessageMapping("/game/decline-draw")
    public void declineDraw(@Payload Map<String, String> payload) {
        String gameId = payload.get("gameId");
        ActiveGame ag = gameService.getActiveGame(gameId);
        if (ag == null) return;

        ag.drawOfferedBy = null;
        messaging.convertAndSend("/topic/game/" + gameId, GameMessage.drawDeclined());
    }

    @MessageMapping("/chat/message")
    public void chatMessage(@Payload ChatPayload payload) {
        ActiveGame ag = gameService.getActiveGame(payload.getGameId());
        if (ag == null) return;

        String content = payload.getContent().length() > 500
                ? payload.getContent().substring(0, 500)
                : payload.getContent();

        String createdAt = java.time.Instant.now().toString();
        messaging.convertAndSend("/topic/game/" + payload.getGameId(),
                GameMessage.chat(payload.getSenderName(), content, createdAt));
    }

    @MessageMapping("/friend/invite")
    public void friendInvite(@Payload Map<String, Object> payload, SimpMessageHeaderAccessor headers) {
        Principal principal = headers.getUser();
        if (principal == null) return;

        String fromUserId = principal.getName();
        String toUserId = (String) payload.get("toUserId");
        int timeControl = ((Number) payload.get("timeControl")).intValue();

        if (!friendshipService.areFriends(fromUserId, toUserId)) {
            messaging.convertAndSendToUser(fromUserId, "/queue/error",
                    Map.of("code", "NOT_FRIENDS", "message", "You are not friends with this user."));
            return;
        }

        User fromUser = userService.findById(fromUserId);

        PendingInvite invite = new PendingInvite();
        invite.inviteId = UUID.randomUUID().toString();
        invite.fromSessionId = headers.getSessionId();
        invite.fromUserId = fromUserId;
        invite.fromName = fromUser.getName();
        invite.fromRating = fromUser.getRating();
        invite.toUserId = toUserId;
        invite.timeControl = timeControl;
        invite.expiresAt = System.currentTimeMillis() + 60_000;
        pendingInvites.put(invite.inviteId, invite);

        messaging.convertAndSend("/topic/user/" + toUserId + "/invite",
                Map.of("inviteId", invite.inviteId,
                        "fromUserId", fromUserId,
                        "fromName", fromUser.getName(),
                        "fromRating", fromUser.getRating(),
                        "timeControl", timeControl));

        log.info("Game invite sent from {} to {}", fromUserId, toUserId);
    }

    @MessageMapping("/friend/invite-response")
    public void friendInviteResponse(@Payload Map<String, Object> payload, SimpMessageHeaderAccessor headers) {
        Principal principal = headers.getUser();
        if (principal == null) return;

        String responderUserId = principal.getName();
        String inviteId = (String) payload.get("inviteId");
        boolean accepted = Boolean.TRUE.equals(payload.get("accepted"));

        PendingInvite invite = pendingInvites.remove(inviteId);
        if (invite == null) {
            messaging.convertAndSendToUser(responderUserId, "/queue/error",
                    Map.of("code", "INVITE_EXPIRED", "message", "Invite expired or not found."));
            return;
        }

        if (System.currentTimeMillis() > invite.expiresAt) {
            messaging.convertAndSendToUser(responderUserId, "/queue/error",
                    Map.of("code", "INVITE_EXPIRED", "message", "Invite has expired."));
            return;
        }

        if (!accepted) {
            messaging.convertAndSend("/topic/user/" + invite.fromUserId + "/invite-declined",
                    Map.of("message", invite.toUserId + " declined your invite."));
            return;
        }

        try {
            User fromUser = userService.findById(invite.fromUserId);
            User toUser = userService.findById(responderUserId);

            boolean fromIsWhite = Math.random() < 0.5;
            String whiteUserId  = fromIsWhite ? invite.fromUserId   : responderUserId;
            String blackUserId  = fromIsWhite ? responderUserId      : invite.fromUserId;
            String whiteName    = fromIsWhite ? fromUser.getName()   : toUser.getName();
            String blackName    = fromIsWhite ? toUser.getName()     : fromUser.getName();
            int    whiteRating  = fromIsWhite ? fromUser.getRating() : toUser.getRating();
            int    blackRating  = fromIsWhite ? toUser.getRating()   : fromUser.getRating();
            String whiteSession = fromIsWhite ? invite.fromSessionId : headers.getSessionId();
            String blackSession = fromIsWhite ? headers.getSessionId() : invite.fromSessionId;

            Game dbGame = new Game();
            dbGame.setWhitePlayerId(whiteUserId);
            dbGame.setBlackPlayerId(blackUserId);
            dbGame.setWhiteGuestId(whiteUserId);   // authenticated users: reuse userId as guestId
            dbGame.setBlackGuestId(blackUserId);
            dbGame.setWhiteName(whiteName);
            dbGame.setBlackName(blackName);
            dbGame.setWhiteRating(whiteRating);
            dbGame.setBlackRating(blackRating);
            dbGame.setTimeControl(invite.timeControl);
            dbGame.setWhiteTimeLeft((long) invite.timeControl * 1000);
            dbGame.setBlackTimeLeft((long) invite.timeControl * 1000);
            dbGame.setStatus(GameStatus.ACTIVE);
            dbGame.setStartedAt(LocalDateTime.now());
            dbGame = gameRepository.save(dbGame);

            gameService.createActiveGame(dbGame, whiteSession, blackSession);

            String whiteColor = "white";
            String blackColor = "black";

            messaging.convertAndSend("/topic/user/" + invite.fromUserId + "/matched",
                    Map.of("gameId", dbGame.getId(),
                            "color", fromIsWhite ? whiteColor : blackColor,
                            "opponent", Map.of("name", toUser.getName(), "rating", toUser.getRating()),
                            "timeControl", invite.timeControl));

            messaging.convertAndSend("/topic/user/" + responderUserId + "/matched",
                    Map.of("gameId", dbGame.getId(),
                            "color", fromIsWhite ? blackColor : whiteColor,
                            "opponent", Map.of("name", fromUser.getName(), "rating", fromUser.getRating()),
                            "timeControl", invite.timeControl));

            log.info("Friend game created: {} (white={}, black={})", dbGame.getId(), whiteName, blackName);
        } catch (Exception e) {
            log.error("Error creating friend game: {}", e.getMessage());
        }
    }

    @MessageMapping("/game/webrtc-signal")
    public void webrtcSignal(@Payload Map<String, Object> payload) {
        String gameId = (String) payload.get("gameId");
        if (gameId == null) return;
        if (gameService.getActiveGame(gameId) == null) return;
        messaging.convertAndSend("/topic/game/" + gameId, payload);
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        matchmaking.remove(sessionId); // removes by sessionId won't match guestId — harmless
        gameService.handleDisconnect(sessionId);
    }

    private GameMessage buildStateMessage(ActiveGame ag) {
        GameMessage state = new GameMessage();
        state.setType("state");
        state.setFen(ag.board.getFen());
        state.setMoves(ag.moves);
        state.setTurn(ag.board.getSideToMove().value().equals("WHITE") ? "w" : "b");
        state.setWhiteTimeLeft(ag.whiteTimeLeft);
        state.setBlackTimeLeft(ag.blackTimeLeft);
        state.setStatus(GameStatus.ACTIVE.name());

        GameMessage.PlayerInfo white = new GameMessage.PlayerInfo();
        white.setId(ag.whiteGuestId);
        white.setName(ag.whiteName);
        white.setRating(ag.whiteRatingSnapshot);
        white.setGuest(ag.whiteUserId == null);
        state.setWhite(white);

        GameMessage.PlayerInfo black = new GameMessage.PlayerInfo();
        black.setId(ag.blackGuestId);
        black.setName(ag.blackName);
        black.setRating(ag.blackRatingSnapshot);
        black.setGuest(ag.blackUserId == null);
        state.setBlack(black);

        return state;
    }
}
