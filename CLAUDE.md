# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project structure

This is a **two-service monorepo**:

```
chess-time/          ← Next.js 14 frontend (this directory)
chess-time-api/      ← Spring Boot backend
```

---

## Frontend (Next.js 14)

### Commands

```bash
npm run dev      # Start Next.js dev server on :3000
npm run build    # Production build
npx tsc --noEmit # Type check
```

### Key env var

```
NEXT_PUBLIC_API_URL=http://localhost:8080   # in .env.local
```

### Auth flow

No NextAuth. Auth is entirely JWT-based, delegated to Spring Boot:
1. User clicks "Sign in with GitHub/Google" → redirected to `{API}/oauth2/authorization/github`
2. Spring Boot handles OAuth2 dance, issues JWT, redirects to `/auth/callback?token=<jwt>`
3. `/auth/callback/page.tsx` stores JWT in `localStorage` via `src/lib/auth.ts`
4. `AuthContext` (`src/context/AuthContext.tsx`) wraps the app — reads token, exposes `user`, `token`, `signOut`
5. Use `useAuth()` hook anywhere to access current user

Guest flow: UUID in `localStorage` (`chess-guest-id`). No auth call needed. Rating is session-only on the backend.

### Real-time (STOMP over WebSocket)

`useStompClient(token)` (`src/hooks/useStompClient.ts`) maintains a singleton `@stomp/stompjs` `Client` using `SockJS` transport to `{API}/ws`.

Event model is different from Socket.io — all game events go to a **single topic** `/topic/game/{gameId}` and are distinguished by a `type` field in the JSON body: `"move"`, `"state"`, `"over"`, `"draw_offered"`, `"draw_declined"`, `"chat"`.

Private server→client messages (matched notification, error, state on reconnect) go to `/user/queue/...` destinations.

### CSS

All components use **CSS Modules** (`Component.module.css` co-located next to each component). No Tailwind, no global utility classes.

---

## Backend (Spring Boot — `chess-time-api/`)

### Commands

The Maven wrapper (`mvnw`) is not committed — generate it first:

```bash
# From chess-time-api/ — one-time setup
mvn -N io.takari:maven:wrapper

# Then:
./mvnw spring-boot:run           # Start on :8080 (dev)  [Windows: mvnw.cmd spring-boot:run]
./mvnw clean package             # Build JAR
./mvnw test                      # Run tests
./mvnw test -Dtest=ClassName     # Run a single test class
```

### Key env vars / application.yml overrides

```
DB_USERNAME, DB_PASSWORD         # MySQL credentials (default: root / ASDF)
JWT_SECRET                       # Min 256-bit random string
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
FRONTEND_URL                     # default: http://localhost:3000
```

> **Important**: Spring Boot validates OAuth2 client registrations at startup and **will refuse to start** if `GITHUB_CLIENT_ID` or `GOOGLE_CLIENT_ID` are empty. Always set these env vars (use placeholder strings if OAuth login isn't needed locally):
> ```powershell
> $env:GITHUB_CLIENT_ID="placeholder"; $env:GITHUB_CLIENT_SECRET="placeholder"
> $env:GOOGLE_CLIENT_ID="placeholder"; $env:GOOGLE_CLIENT_SECRET="placeholder"
> mvn spring-boot:run
> ```

MySQL service on Windows is `MySQL80` (`net start MySQL80` requires an admin terminal). Root password is `ASDF`.

Database: MySQL — `chesstime` schema, auto-created on first start via `createDatabaseIfNotExist=true`. Schema managed by Hibernate `ddl-auto: update` (no migration files — Hibernate diffs and alters tables automatically).

### Package layout

```
com.chesstime
├── config/          WebSocketConfig, SecurityConfig, JwtAuthFilter, OAuth2SuccessHandler
├── controller/      GameSocketController (STOMP), GameRestController, UserController
├── service/         GameService, MatchmakingService, EloService, UserService, JwtService
├── model/           JPA entities (User, Game, Move, RatingHistory, ChatMessage)
├── repository/      Spring Data JPA repos
└── dto/             GameMessage (broadcast envelope), MovePayload, QueueJoinPayload, ChatPayload
```

### STOMP destination map

| Direction | Destination | Purpose |
|---|---|---|
| Client → Server | `/app/queue/join` | Enter matchmaking queue |
| Client → Server | `/app/queue/leave` | Leave queue |
| Client → Server | `/app/game/move` | Submit a move |
| Client → Server | `/app/game/resign` | Resign |
| Client → Server | `/app/game/offer-draw` / `accept-draw` / `decline-draw` | Draw flow |
| Client → Server | `/app/game/request-state` | Reconnect / resync |
| Client → Server | `/app/chat/message` | Send chat |
| Server → Client | `/topic/game/{gameId}` | Broadcast to both players |
| Server → Client | `/user/queue/matched` | Private: match found |
| Server → Client | `/user/queue/game-state` | Private: full state on reconnect |
| Server → Client | `/user/queue/error` | Private: illegal move / not your turn |

### Architecture decisions

- **STOMP destinations**: clients publish to `/app/...`, server broadcasts to `/topic/game/{gameId}` (all players) or sends privately to `/user/{sessionId}/queue/...` (one player).
- **In-memory game state** (`GameService.ActiveGame`): holds a `chesslib` `Board` instance per game. DB writes are async (per-move) and sync at game end.
- **Clock**: `@Scheduled(fixedRate=100)` in `GameService.tickClocks()` decrements the active player's time every 100ms. Server-authoritative.
- **Matchmaking**: in-memory `ConcurrentHashMap` in `MatchmakingService`. `@Scheduled(fixedRate=2000)` in `GameSocketController.matchmakingTick()` runs the pairing algorithm.
- **Chess logic**: `com.github.bhlangonijr:chesslib` — always validate moves server-side. If illegal, send error + authoritative FEN back to that client only.
- **Server is FEN authority**: never trust the FEN sent by a client. Always use `ag.board.getFen()`.
- **OAuth2 success**: `OAuth2SuccessHandler` creates/updates user in MySQL, generates JWT, redirects to `{frontendUrl}/auth/callback?token=<jwt>`.
