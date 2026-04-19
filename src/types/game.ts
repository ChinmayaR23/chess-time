export type GameStatus = "WAITING" | "ACTIVE" | "FINISHED" | "ABANDONED";
export type GameResult = "WHITE_WINS" | "BLACK_WINS" | "DRAW" | "ABORTED";
export type PlayerColor = "white" | "black";

export interface PlayerInfo {
  id?: string; // userId or guestId
  name: string;
  rating: number;
  isGuest: boolean;
}

export interface MoveRecord {
  moveIndex: number;
  san: string;
  uci: string;
  fen: string;
}

export interface GameState {
  gameId: string;
  fen: string;
  moves: MoveRecord[];
  turn: "w" | "b";
  whiteTimeLeft: number;
  blackTimeLeft: number;
  status: GameStatus;
  result?: GameResult;
  winner?: PlayerColor | null;
  white: PlayerInfo;
  black: PlayerInfo;
}

export interface TimeControl {
  label: string;
  seconds: number;
}

export const TIME_CONTROLS: TimeControl[] = [
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
];
