export type Color = 'w' | 'b';
export interface EngineOptions {
  threads: number;
  hash: number;
  multiPv: number;
  movetime: number;
  depth: number | null;
}
export interface EngineLine {
  rank: number;
  depth: number;
  nodes: number;
  cp: number | null;
  mate: number | null;
  wdl: [number, number, number] | null;
  pv: string[];
}
export interface Analysis {
  lines: EngineLine[];
  cached: boolean;
  engineId: string;
}
export interface Game {
  id: string;
  pgn: string;
  white: string;
  black: string;
  whiteElo?: string;
  blackElo?: string;
  result: string;
  date: number;
  timeClass: string;
  timeControl: string;
  source: 'pgn' | 'chess.com';
  url?: string;
}
export interface PositionNode {
  id: string;
  parent: string | null;
  fen: string;
  san: string;
  uci: string;
  ply: number;
  main: boolean;
}
export interface GameTree {
  rootFen: string;
  nodes: PositionNode[];
  mainIds: string[];
}
export type Category =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'book';
export interface MoveReview {
  ply: number;
  color: Color;
  category: Category;
  loss: number;
  explanation: string;
  best: string;
}
export interface Review {
  classificationVersion?: number;
  version: number;
  engineId: string;
  options: EngineOptions;
  positions: Record<string, Analysis>;
  moves: MoveReview[];
  complete: boolean;
}
export interface Settings {
  sounds: boolean;
  soundVolume: number;
  customSounds?: Partial<
    Record<'move' | 'capture' | 'check' | 'mate', { name: string; data: string }>
  >;
  autoReview: boolean;
  autoReviewTime: number;
  username: string;
  profileImage?: string;
  theme: 'dark' | 'light';
  arrows: boolean;
  secondArrow: boolean;
  evaluation: boolean;
  threads: number;
  hash: number;
  multiPv: number;
  interactiveTime: number;
  depth: number | null;
  reviewTime: number;
}
export const defaultSettings: Settings = {
  sounds: true,
  soundVolume: 0.5,
  autoReview: true,
  autoReviewTime: 5000,
  username: '',
  theme: 'dark',
  arrows: true,
  secondArrow: false,
  evaluation: true,
  threads: 0,
  hash: 256,
  multiPv: 4,
  interactiveTime: 1000,
  depth: null,
  reviewTime: 5000,
};
