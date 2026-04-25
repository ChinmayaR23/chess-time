"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStompClient, useConnectionId } from "@/hooks/useStompClient";
import { useChessGame } from "@/hooks/useChessGame";
import { useChessClock } from "@/hooks/useChessClock";
import { ChessBoard } from "@/components/board/ChessBoard";
import { MoveHistory } from "@/components/board/MoveHistory";
import { PlayerCard } from "@/components/game/PlayerCard";
import { GameResultModal } from "@/components/game/GameResultModal";
import { GameChat } from "@/components/chat/GameChat";
import { VideoChat } from "@/components/game/VideoChat";
import { useWebRTC } from "@/hooks/useWebRTC";
import { PlayerColor, PlayerInfo } from "@/types/game";
import { getOrCreateGuestId, getOrCreateGuestName } from "@/lib/guest";
import styles from "./GameRoom.module.css";

type GameResult = "WHITE_WINS" | "BLACK_WINS" | "DRAW" | "ABORTED";

interface GameRoomProps {
  gameId: string;
  initialColor: PlayerColor;
  initialTimeMs?: number | null;
  initialOpponent?: { name: string; rating: number } | null;
}

export function GameRoom({ gameId, initialColor, initialTimeMs, initialOpponent }: GameRoomProps) {
  const { user, token } = useAuth();
  const guestId = getOrCreateGuestId();
  const guestName = getOrCreateGuestName();

  const client = useStompClient(token);
  const connectionId = useConnectionId();
  const [color] = useState<PlayerColor>(initialColor);

  const [gameOver, setGameOver] = useState<{
    result: GameResult;
    winner: PlayerColor | null;
    ratingDelta?: { white: number; black: number };
  } | null>(null);

  const [whitePlayer, setWhitePlayer] = useState<PlayerInfo>({
    name: color === "white" ? (user?.name ?? guestName) : (initialOpponent?.name ?? "Opponent"),
    rating: color === "white" ? (user?.rating ?? 1200) : (initialOpponent?.rating ?? 1200),
    isGuest: color === "white" ? !user : false,
  });
  const [blackPlayer, setBlackPlayer] = useState<PlayerInfo>({
    name: color === "black" ? (user?.name ?? guestName) : (initialOpponent?.name ?? "Opponent"),
    rating: color === "black" ? (user?.rating ?? 1200) : (initialOpponent?.rating ?? 1200),
    isGuest: color === "black" ? !user : false,
  });

  const [serverWhiteTime, setServerWhiteTime] = useState(initialTimeMs ?? 600_000);
  const [serverBlackTime, setServerBlackTime] = useState(initialTimeMs ?? 600_000);
  const [serverTurn, setServerTurn] = useState<"w" | "b">("w");
  const [drawOffer, setDrawOffer] = useState<PlayerColor | null>(null);

  const {
    videoState, localStream, remoteStream,
    startVideo, acceptVideo, declineVideo, stopVideo, handleSignal,
  } = useWebRTC({ client, gameId, myColor: color });

  const { fen, moves, isMyTurn, onDrop } = useChessGame({ client, gameId, color });
  const { whiteTime, blackTime } = useChessClock({
    whiteTimeLeft: serverWhiteTime,
    blackTimeLeft: serverBlackTime,
    currentTurn: serverTurn,
    gameOver: !!gameOver,
  });

  useEffect(() => {
    if (!client.active) return;

    // Request state (reconnection support)
    client.publish({
      destination: "/app/game/request-state",
      body: JSON.stringify({ gameId, guestId }),
    });

    // Private state channel
    const stateSub = client.subscribe("/user/queue/game-state", (msg) => {
      const state = JSON.parse(msg.body);
      if (state.white) setWhitePlayer({ name: state.white.name, rating: state.white.rating, isGuest: state.white.guest });
      if (state.black) setBlackPlayer({ name: state.black.name, rating: state.black.rating, isGuest: state.black.guest });
      setServerWhiteTime(state.whiteTimeLeft);
      setServerBlackTime(state.blackTimeLeft);
      setServerTurn(state.turn);
    });

    // Game topic (moves, over, draw, chat, webrtc signals)
    const gameSub = client.subscribe(`/topic/game/${gameId}`, (msg) => {
      const data = JSON.parse(msg.body);

      if (data.type === "move") {
        const turn = data.fen.split(" ")[1] as "w" | "b";
        setServerTurn(turn);
      } else if (data.type === "over") {
        setGameOver({ result: data.result, winner: data.winner, ratingDelta: data.ratingDelta });
      } else if (data.type === "draw_offered" && data.by !== color) {
        setDrawOffer(data.by);
      } else if (data.type === "draw_declined") {
        setDrawOffer(null);
      } else if (typeof data.type === "string" && data.type.startsWith("webrtc_")) {
        handleSignal(data);
      }
    });

    return () => {
      stateSub.unsubscribe();
      gameSub.unsubscribe();
    };
  }, [client, gameId, guestId, color, connectionId, handleSignal]);

  // Stop video when game ends
  useEffect(() => {
    if (gameOver && videoState !== "off") stopVideo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const resign = () => {
    if (gameOver) return;
    client.publish({ destination: "/app/game/resign", body: JSON.stringify({ gameId, color }) });
  };

  const offerDraw = () => {
    if (gameOver) return;
    client.publish({ destination: "/app/game/offer-draw", body: JSON.stringify({ gameId, color }) });
  };

  const acceptDraw = () => {
    client.publish({ destination: "/app/game/accept-draw", body: JSON.stringify({ gameId }) });
    setDrawOffer(null);
  };

  const declineDraw = () => {
    client.publish({ destination: "/app/game/decline-draw", body: JSON.stringify({ gameId }) });
    setDrawOffer(null);
  };

  const currentTurn: PlayerColor = serverTurn === "w" ? "white" : "black";
  const opponent = color === "white" ? blackPlayer : whitePlayer;
  const me = color === "white" ? whitePlayer : blackPlayer;

  return (
    <div className={styles.wrapper}>
      <div className={styles.boardCol}>
        <PlayerCard player={opponent} timeMs={color === "white" ? blackTime : whiteTime} isActive={currentTurn !== color} />
        <div className={styles.boardSpacer}>
          <ChessBoard fen={fen} orientation={color} onDrop={onDrop} isMyTurn={isMyTurn && !gameOver} />
        </div>
        <PlayerCard player={me} timeMs={color === "white" ? whiteTime : blackTime} isActive={currentTurn === color} />

        {!gameOver && (
          <div className={styles.actions}>
            <button onClick={offerDraw} className={styles.drawBtn}>Draw</button>
            <button onClick={resign} className={styles.resignBtn}>Resign</button>
          </div>
        )}

        {drawOffer && !gameOver && (
          <div className={styles.drawBanner}>
            <span className={styles.drawBannerText}>Draw offered</span>
            <div className={styles.drawBannerBtns}>
              <button onClick={acceptDraw} className={styles.acceptBtn}>Accept</button>
              <button onClick={declineDraw} className={styles.declineBtn}>Decline</button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.sidePanel}>
        <VideoChat
          videoState={videoState}
          localStream={localStream}
          remoteStream={remoteStream}
          onStart={startVideo}
          onAccept={acceptVideo}
          onDecline={declineVideo}
          onStop={stopVideo}
        />
        <div className={styles.moveHistoryWrap}><MoveHistory moves={moves} /></div>
        <GameChat client={client} gameId={gameId} myName={user?.name ?? guestName} myUserId={user?.id} />
      </div>

      {gameOver && (
        <GameResultModal result={gameOver.result} winner={gameOver.winner} myColor={color} ratingDelta={gameOver.ratingDelta} />
      )}
    </div>
  );
}
