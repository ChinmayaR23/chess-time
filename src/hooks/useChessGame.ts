"use client";

import { useCallback, useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Client } from "@stomp/stompjs";
import { useConnectionId } from "@/hooks/useStompClient";
import { MoveRecord, PlayerColor } from "@/types/game";

interface UseChessGameOptions {
  client: Client;
  gameId: string;
  color: PlayerColor;
  initialFen?: string;
  initialMoves?: MoveRecord[];
}

export function useChessGame({
  client,
  gameId,
  color,
  initialFen,
  initialMoves = [],
}: UseChessGameOptions) {
  const [chess] = useState(() => {
    const c = new Chess();
    if (initialFen) c.load(initialFen);
    return c;
  });
  const [fen, setFen] = useState(initialFen ?? chess.fen());
  const [moves, setMoves] = useState<MoveRecord[]>(initialMoves);
  const [isMyTurn, setIsMyTurn] = useState(
    color === "white" ? chess.turn() === "w" : chess.turn() === "b"
  );
  const connectionId = useConnectionId();

  useEffect(() => {
    if (!client.active) return;

    const sub = client.subscribe(`/topic/game/${gameId}`, (msg) => {
      const data = JSON.parse(msg.body);

      if (data.type === "move") {
        chess.load(data.fen);
        setFen(data.fen);
        setMoves((prev) => {
          const next = [...prev];
          next[data.moveIndex] = {
            moveIndex: data.moveIndex,
            san: data.san,
            uci: `${data.from}${data.to}${data.promotion ?? ""}`,
            fen: data.fen,
          };
          return next;
        });
        setIsMyTurn(color === "white" ? chess.turn() === "w" : chess.turn() === "b");
      } else if (data.type === "state") {
        chess.load(data.fen);
        setFen(data.fen);
        setMoves(data.moves ?? []);
        setIsMyTurn(color === "white" ? data.turn === "w" : data.turn === "b");
      }
    });

    return () => sub.unsubscribe();
  }, [client, gameId, chess, color, connectionId]);

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string): boolean => {
      if (!isMyTurn) return false;

      const isPromotion =
        piece[1] === "P" &&
        ((color === "white" && targetSquare[1] === "8") ||
          (color === "black" && targetSquare[1] === "1"));

      const testChess = new Chess(chess.fen());
      const result = testChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: isPromotion ? "q" : undefined,
      });
      if (!result) return false;

      // Optimistic update
      chess.load(testChess.fen());
      setFen(testChess.fen());
      setIsMyTurn(false);

      client.publish({
        destination: "/app/game/move",
        body: JSON.stringify({
          gameId,
          from: sourceSquare,
          to: targetSquare,
          promotion: isPromotion ? "q" : null,
        }),
      });

      return true;
    },
    [chess, client, color, gameId, isMyTurn]
  );

  return { fen, moves, isMyTurn, onDrop, chess };
}
