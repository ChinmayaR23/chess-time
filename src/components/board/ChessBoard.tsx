"use client";

import { Chessboard } from "react-chessboard";
import { PlayerColor } from "@/types/game";

interface ChessBoardProps {
  fen: string;
  orientation: PlayerColor;
  onDrop: (source: string, target: string, piece: string) => boolean;
  isMyTurn: boolean;
}

export function ChessBoard({ fen, orientation, onDrop, isMyTurn }: ChessBoardProps) {
  return (
    <Chessboard
      position={fen}
      boardOrientation={orientation}
      onPieceDrop={onDrop}
      arePiecesDraggable={isMyTurn}
      customBoardStyle={{ borderRadius: "4px", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
      customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
      customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
    />
  );
}
