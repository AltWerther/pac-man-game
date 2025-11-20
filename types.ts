export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  NONE = 'NONE'
}

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  DOT = 2,
  POWER_PELLET = 3,
  PACMAN_SPAWN = 4,
  GHOST_SPAWN = 5,
  DOOR = 6,
  FRUIT = 7
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity extends Position {
  id: string;
  direction: Direction;
  nextDirection: Direction;
  color: string;
  isGhost: boolean;
  isScared?: boolean;
  isDead?: boolean;
}

export interface GameState {
  map: number[][];
  pacman: Entity;
  ghosts: Entity[];
  score: number;
  lives: number;
  status: 'IDLE' | 'PLAYING' | 'GAME_OVER' | 'WON';
  powerModeTime: number;
  dotsEaten: number;
  fruitTimer: number;
  difficulty: Difficulty;
}