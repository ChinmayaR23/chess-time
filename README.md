# Chess Time

A real-time chess platform with Elo-based matchmaking, friend games, in-game chat, and WebRTC video chat.

**Live:** https://chesstime.duckdns.org

---

## Table of Contents

1. [High-Level Design](#high-level-design)
2. [Backend Low-Level Design](#backend-low-level-design)
3. [Local Development](#local-development)

---

## High-Level Design

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Client                           │
│  Next.js 14 (App Router) · TypeScript · CSS Modules     │
│                                                         │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Auth     │  │  Game Board  │  │  Video Chat     │  │
│  │  Context  │  │  (react-     │  │  (WebRTC P2P)   │  │
│  │  (JWT)    │  │  chessboard) │  │                 │  │
│  └───────────┘  └──────────────┘  └─────────────────┘  │
│         │              │                   │            │
│         │       STOMP/WebSocket (SockJS)    │ WebRTC     │
└─────────┼──────────────┼───────────────────┼────────────┘
          │              │                   │
          │ HTTPS/REST   │ wss://…/ws         │ STUN (Google)
          ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                   Spring Boot API  :8080                 │
│                                                         │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Security  │  │  STOMP Msg   │  │  Scheduled      │  │
│  │  (JWT +    │  │  Broker      │  │  Tasks          │  │
│  │  OAuth2)   │  │  (in-process)│  │  (clock ticks,  │  │
│  └────────────┘  └──────────────┘  │  matchmaking)   │  │
│                                    └─────────────────┘  │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ GameService│  │ Matchmaking  │  │  EloService     │  │
│  │ (in-memory │  │ Service      │  │  (K-factor +    │  │
│  │  state)    │  │ (in-memory   │  │  expected score)│  │
│  └────────────┘  │  queue)      │  └─────────────────┘  │
│                  └──────────────┘                        │
└──────────────────────────┬──────────────────────────────┘
                           │ JDBC (Hibernate)
                           ▼
              ┌────────────────────────┐
              │   MySQL 8.0            │
              │   schema: chesstime    │
              │                        │
              │  users · games · moves │
              │  rating_history        │
              │  friend_requests       │
              │  chat_messages         │
              └────────────────────────┘
```

### AWS Deployment

```
Internet
   │
   ▼ HTTPS :443
┌──────────────────────────────────────┐
│  EC2 t2.micro  (eu-north-1)          │
│  nginx (TLS termination via certbot) │
│                                      │
│  /api/*  ──►  :8080  Spring Boot     │
│  /ws/*   ──►  :8080  (WebSocket)     │
│  /*      ──►  :3000  Next.js         │
└──────────────────────────┬───────────┘
                           │ VPC (private subnet)
                           ▼
              ┌────────────────────────┐
              │  RDS db.t3.micro       │
              │  MySQL 8.0             │
              │  chess-time-db.…rds    │
              └────────────────────────┘
```

CI/CD: GitHub Actions pushes → builds Spring Boot JAR + Next.js standalone → rsync to EC2 → `systemctl restart`.

### Auth Flow

```
User clicks "Sign in with GitHub"
  │
  ▼
Browser → GET /oauth2/authorization/github  (Spring Boot)
  │
  ▼
GitHub OAuth dance  (Spring Security OAuth2 Client)
  │
  ▼
OAuth2SuccessHandler.onAuthenticationSuccess()
  ├─ create/update User row in MySQL
  ├─ sign JWT (HS256, 7-day TTL)
  └─ redirect → {frontendUrl}/auth/callback?token=<jwt>
        │
        ▼
  /auth/callback/page.tsx
  └─ localStorage.setItem("chess-token", jwt)
        │
        ▼
  AuthContext reads token → decodes payload → exposes user
```

Guest flow: client generates a UUID and stores it in `localStorage` as `chess-guest-id`. No server call needed. Rating is session-only (default 1200).

### Real-time Message Flow

All game events travel over a single STOMP topic per game. Messages are distinguished by a `type` field.

```
Client A  ────publish──►  /app/game/move
                              │
                    GameSocketController
                              │ validates session & turn
                    GameService.applyMove()
                              │ chesslib validates legality
                              │
                    convertAndSend ──►  /topic/game/{gameId}
                              │               │
                         Client A ◄───────────┘
                         Client B ◄───────────┘
```

Private server→client messages go to `/user/{sessionId}/queue/...` so only one player receives them.

---

## Backend Low-Level Design

### Package Layout

```
com.chesstime
├── config/
│   ├── SecurityConfig.java        — CORS, JWT filter, OAuth2, stateless session
│   ├── WebSocketConfig.java       — STOMP broker, /app prefix, /ws SockJS endpoint
│   ├── JwtAuthFilter.java         — reads Bearer token, sets SecurityContext
│   └── OAuth2SuccessHandler.java  — post-OAuth user upsert + JWT redirect
├── controller/
│   ├── GameSocketController.java  — all STOMP @MessageMapping handlers
│   ├── GameRestController.java    — REST: game history, game detail
│   ├── UserController.java        — REST: profile, search, rating history
│   └── FriendController.java      — REST: friend requests, friend list
├── service/
│   ├── GameService.java           — in-memory game state, move validation, clock, finalization
│   ├── MatchmakingService.java    — queue management, pairing algorithm
│   ├── EloService.java            — K-factor + expected score calculation
│   ├── FriendshipService.java     — friend request lifecycle
│   ├── UserService.java           — user CRUD + rating updates
│   └── JwtService.java            — sign / verify JWTs
├── model/                         — JPA entities (see Data Model below)
├── repository/                    — Spring Data JPA interfaces
└── dto/
    ├── GameMessage.java           — broadcast envelope (type + union of fields)
    ├── MovePayload.java           — from/to/promotion + gameId
    ├── QueueJoinPayload.java      — userId/guestId/name/rating/timeControl
    └── ChatPayload.java           — gameId/senderName/content
```

### Data Model

```
users
  id             VARCHAR(36) PK   (UUID from OAuth2 subject)
  provider       VARCHAR           github | google
  name           VARCHAR
  email          VARCHAR
  avatar_url     VARCHAR
  rating         INT  DEFAULT 1200
  games_played   INT  DEFAULT 0
  wins/losses/draws INT DEFAULT 0
  created_at     DATETIME

games
  id             VARCHAR(36) PK   (UUID, auto-generated)
  white_player_id  FK → users.id  (nullable — guests)
  black_player_id  FK → users.id  (nullable)
  white_guest_id   VARCHAR        (always set; equals userId for auth users)
  black_guest_id   VARCHAR
  white_name / black_name VARCHAR
  white_rating / black_rating INT  (snapshot at game start)
  fen            TEXT             (final FEN written at game end)
  status         ENUM  WAITING | ACTIVE | FINISHED
  result         ENUM  WHITE_WINS | BLACK_WINS | DRAW | ABORTED
  winner         VARCHAR          white | black | null
  time_control   INT  (seconds per side)
  white_time_left / black_time_left  BIGINT (ms)
  started_at / ended_at / created_at DATETIME

moves
  id             BIGINT PK AUTO_INCREMENT
  game_id        FK → games.id
  move_index     INT
  san            VARCHAR   (long algebraic via chesslib)
  uci            VARCHAR   (e2e4, e7e8q, …)
  fen            TEXT      (board state after this move)

rating_history
  id             BIGINT PK AUTO_INCREMENT
  user_id        FK → users.id
  game_id        VARCHAR
  rating_before / rating_after / delta  INT

friend_requests
  id             BIGINT PK AUTO_INCREMENT
  from_user_id   FK → users.id
  to_user_id     FK → users.id
  status         ENUM  PENDING | ACCEPTED | DECLINED

chat_messages
  id             BIGINT PK AUTO_INCREMENT
  game_id        FK → games.id
  sender_name    VARCHAR
  content        TEXT
  created_at     DATETIME
```

Hibernate `ddl-auto: update` — schema is diffed and altered automatically on startup, no migration files.

### STOMP Destination Map

| Direction | Destination | Handler | Description |
|---|---|---|---|
| C→S | `/app/queue/join` | `queueJoin` | Enter matchmaking queue |
| C→S | `/app/queue/leave` | `queueLeave` | Leave queue |
| C→S | `/app/game/move` | `gameMove` | Submit a move |
| C→S | `/app/game/resign` | `resign` | Resign |
| C→S | `/app/game/offer-draw` | `offerDraw` | Offer draw |
| C→S | `/app/game/accept-draw` | `acceptDraw` | Accept draw offer |
| C→S | `/app/game/decline-draw` | `declineDraw` | Decline draw offer |
| C→S | `/app/game/request-state` | `requestState` | Reconnect / resync |
| C→S | `/app/chat/message` | `chatMessage` | Send chat message |
| C→S | `/app/friend/invite` | `friendInvite` | Send game invite to friend |
| C→S | `/app/friend/invite-response` | `friendInviteResponse` | Accept/decline invite |
| C→S | `/app/game/webrtc-signal` | `webrtcSignal` | Relay WebRTC signal |
| S→C | `/topic/game/{gameId}` | broadcast | move · state · over · draw_offered · draw_declined · chat · webrtc_* |
| S→C | `/user/queue/matched` | private | Match found (random matchmaking) |
| S→C | `/user/queue/game-state` | private | Full state on reconnect |
| S→C | `/user/queue/error` | private | Illegal move / not your turn |
| S→C | `/topic/user/{userId}/invite` | broadcast | Incoming friend game invite |
| S→C | `/topic/user/{userId}/matched` | broadcast | Friend game started |
| S→C | `/topic/user/{userId}/invite-declined` | broadcast | Friend declined invite |

### GameService — In-Memory State

Each active game is an `ActiveGame` object stored in a `ConcurrentHashMap<String, ActiveGame>`.

```
ActiveGame {
  gameId          String
  board           chesslib.Board   ← authoritative board state
  whiteSessionId  String           ← STOMP session, updated on reconnect
  blackSessionId  String
  whiteGuestId    String
  blackGuestId    String
  whiteUserId     String           ← nullable (guests)
  blackUserId     String
  whiteName       String
  blackName       String
  whiteRatingSnapshot  int
  blackRatingSnapshot  int
  whiteTimeLeft   long (ms)
  blackTimeLeft   long (ms)
  lastTickAt      long             ← wall-clock ms, reset on every move
  drawOfferedBy   String           ← "white" | "black" | null
  moves           List<MoveRecord> ← SAN + UCI + FEN per move
  abandonTimers   Map<guestId, ScheduledFuture>
}
```

**Server is the FEN authority.** The client never dictates board state — every move is validated against `board.legalMoves()` using chesslib. If illegal, the server sends a corrective `game-state` message to that client only.

### Move Lifecycle

```
Client publishes /app/game/move  {gameId, from, to, promotion}
  │
  GameSocketController.gameMove()
  ├─ look up ActiveGame by gameId
  ├─ verify sessionId belongs to this game
  ├─ verify it is this player's turn  → else send /user/queue/error
  │
  GameService.applyMove()
  ├─ build chesslib Move (with promotion piece if present)
  ├─ check move ∈ board.legalMoves()  → return null if illegal
  ├─ board.doMove(move)
  ├─ reset lastTickAt (clock resets on each move)
  ├─ append MoveRecord (san, uci, fen) to ag.moves
  ├─ async: persist Move row to DB via ScheduledExecutorService
  ├─ check board.isMated() / isDraw() / isStaleMate()
  │   └─ if true: finalizeGame()
  └─ return SAN string
  │
  broadcast /topic/game/{gameId}  {type:"move", from, to, san, fen, moveIndex}
```

### Clock System

`@Scheduled(fixedRate = 100)` calls `GameService.tickClocks()` every 100 ms.

```
for each ActiveGame:
  elapsed = now - ag.lastTickAt
  ag.lastTickAt = now
  if whiteTurn: ag.whiteTimeLeft -= elapsed
  if ag.whiteTimeLeft <= 0: finalizeGame(BLACK_WINS)
  else:         ag.blackTimeLeft -= elapsed
  if ag.blackTimeLeft <= 0: finalizeGame(WHITE_WINS)
```

The server does not push clock updates over the wire on every tick — clients run their own local countdown and rely on `lastTickAt` being reset on each move to stay synchronized.

### Game Finalization

`GameService.finalizeGame()` is the single exit point for all game-ending conditions (checkmate, stalemate, draw, resign, timeout, abandonment).

```
finalizeGame(ag, result, winner)
  ├─ remove ag from activeGames map  (idempotent guard)
  ├─ cancel all abandon timers
  ├─ EloService.calculate() for both players
  ├─ UserService.updateRating() + saveRatingHistory() for each auth user
  ├─ async: update games row in DB (status=FINISHED, result, winner, fen, endedAt)
  └─ broadcast /topic/game/{gameId}  {type:"over", result, winner, ratingDelta}
```

### Matchmaking Algorithm

Queue is a `ConcurrentHashMap<guestId, QueueEntry>`. A `@Scheduled(fixedRate = 2000)` tick calls `MatchmakingService.findMatches()`.

```
findMatches():
  1. Group queue entries by timeControl
  2. Sort each group by rating (ascending)
  3. For each unmatched player A, scan forward for first unmatched B where:
       ratingDiff <= window(A, B)
       window = max(window(A.joinedAt), window(B.joinedAt))
       window starts at 100, grows +50 per 30s, caps at 400
  4. Color assignment:
       if ratingDiff > 200 → weaker player gets white
       else                → random
  5. Remove matched pairs from queue
  6. Return list of MatchedPair
```

For each pair, `GameSocketController.matchmakingTick()` creates a `Game` DB row, calls `GameService.createActiveGame()`, and sends private `/user/queue/matched` messages to both players.

### Elo Calculation

```
K-factor:
  gamesPlayed < 30  → K = 40  (provisional)
  rating >= 2400    → K = 10  (master)
  else              → K = 20

expectedScore(A, B) = 1 / (1 + 10^((B - A) / 400))

delta = round(K * (actualScore - expectedScore))
newRating = max(100, oldRating + delta)
```

### Disconnect & Reconnect

On `SessionDisconnectEvent`:
1. `MatchmakingService.remove(sessionId)` — clears any queue entry
2. `GameService.handleDisconnect(sessionId)` — schedules a 60-second abandon timer

If the player reconnects within 60 seconds and publishes `/app/game/request-state`:
- Abandon timer is cancelled
- `whiteSessionId` / `blackSessionId` is updated to the new session ID
- Full game state is sent privately to the reconnecting player

If the timer fires, `finalizeGame()` is called with the disconnected player's opponent as winner.

### WebRTC Signaling

The backend is a thin relay — it does not participate in the WebRTC handshake. `/app/game/webrtc-signal` simply broadcasts the payload to `/topic/game/{gameId}` after verifying the game is still active.

```
Signal sequence:
  Initiator sends  webrtc_request
  Answerer sends   webrtc_accept   (after getUserMedia succeeds)
  Initiator sends  webrtc_offer    (SDP)
  Answerer sends   webrtc_answer   (SDP)
  Both sides send  webrtc_ice      (ICE candidates, buffered until remoteDescription is set)
  Either side can  webrtc_stop     (tears down the connection)
```

NAT traversal uses Google STUN servers (`stun.l.google.com:19302`). No TURN server — connections may fail on symmetric NATs.

### Security

- **Stateless** — no HTTP sessions. JWT validated on every request by `JwtAuthFilter`.
- **STOMP auth** — JWT passed as STOMP `login` header on connect; `JwtAuthFilter` sets `SecurityContext` for the STOMP session.
- **CORS** — `allowedOrigins` restricted to `FRONTEND_URL` env var only.
- **Move authorship** — every move handler looks up the STOMP `sessionId` and verifies it matches `ag.whiteSessionId` or `ag.blackSessionId`. Players cannot submit moves for each other.
- **Draw / resign authorship** — color claimed in the payload is cross-checked against `getColorBySessionId()`.
- **Friend invites** — `Principal` (from JWT) is used; `payload.toUserId` is never trusted as the sender's identity.
- **Chat length** — trimmed to 500 characters server-side.

---

## Local Development

### Prerequisites

- Node.js 18+, Java 19+, Maven 3.9+, MySQL 8.0

### Frontend

```bash
# in chess-time/
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev                  # http://localhost:3000
```

### Backend

```powershell
# in chess-time-api/  (Windows — set placeholder OAuth creds to avoid startup failure)
$env:GITHUB_CLIENT_ID="placeholder"; $env:GITHUB_CLIENT_SECRET="placeholder"
$env:GOOGLE_CLIENT_ID="placeholder"; $env:GOOGLE_CLIENT_SECRET="placeholder"
mvn spring-boot:run          # http://localhost:8080
```

MySQL service: `net start MySQL80` (admin terminal). Root password: `ASDF`. Database `chesstime` is auto-created on first start.

### Environment Variables (Backend)

| Variable | Default | Required |
|---|---|---|
| `DB_USERNAME` | `root` | No |
| `DB_PASSWORD` | `ASDF` | No |
| `JWT_SECRET` | `change-this-…` | No (dev only) |
| `GITHUB_CLIENT_ID` | — | Yes (placeholder ok) |
| `GITHUB_CLIENT_SECRET` | — | Yes (placeholder ok) |
| `GOOGLE_CLIENT_ID` | — | Yes (placeholder ok) |
| `GOOGLE_CLIENT_SECRET` | — | Yes (placeholder ok) |
| `FRONTEND_URL` | `http://localhost:3000` | No |
