import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Direction, GameState, Entity, TileType, Position } from './types';
import { INITIAL_MAP, GHOST_COLORS, FRUIT_SPAWN_POS, FRUIT_POINTS, FRUIT_DURATION, DOTS_TO_SPAWN_FRUIT, SPEED_MS } from './constants';
import Grid from './components/Grid';
import { soundManager } from './utils/audio';
import { 
    ArrowUpIcon, 
    ArrowDownIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    ArrowPathIcon 
} from '@heroicons/react/24/solid';
import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tick, setTick] = useState(0);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const lastInputTimeRef = useRef<number>(0);

  // High Score State
  const [highScore, setHighScore] = useState<number>(() => {
      try {
          const saved = localStorage.getItem('pacman_highscore');
          return saved ? parseInt(saved, 10) : 0;
      } catch {
          return 0;
      }
  });

  // Ref for state to access in event listeners/loops without stale closures
  const stateRef = useRef<GameState | null>(null);

  // Initialize Game
  const initGame = useCallback(() => {
    const pacmanStart = findPosition(INITIAL_MAP, TileType.PACMAN_SPAWN);
    const ghostStarts = findAllPositions(INITIAL_MAP, TileType.GHOST_SPAWN);

    const ghosts: Entity[] = ghostStarts.map((pos, index) => ({
      id: `ghost-${index}`,
      x: pos.x,
      y: pos.y,
      direction: [Direction.UP, Direction.LEFT, Direction.RIGHT][index % 3],
      nextDirection: Direction.NONE,
      color: GHOST_COLORS[index % GHOST_COLORS.length],
      isGhost: true,
      isScared: false,
      isDead: false
    }));

    const initialState: GameState = {
      map: INITIAL_MAP.map(row => [...row]),
      pacman: {
        id: 'pacman',
        x: pacmanStart?.x || 1,
        y: pacmanStart?.y || 1,
        direction: Direction.RIGHT,
        nextDirection: Direction.RIGHT,
        color: 'yellow',
        isGhost: false
      },
      ghosts,
      score: 0,
      lives: 3,
      status: 'IDLE',
      powerModeTime: 0,
      dotsEaten: 0,
      fruitTimer: 0
    };

    setGameState(initialState);
    stateRef.current = initialState;
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Handle High Score
  useEffect(() => {
      if (gameState && (gameState.status === 'GAME_OVER' || gameState.status === 'WON')) {
          if (gameState.score > highScore) {
              setHighScore(gameState.score);
              localStorage.setItem('pacman_highscore', gameState.score.toString());
          }
      }
  }, [gameState?.status, gameState?.score, highScore]);

  // --- Helpers ---
  function findPosition(map: number[][], type: TileType): Position | null {
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] === type) return { x, y };
      }
    }
    return null;
  }

  function findAllPositions(map: number[][], type: TileType): Position[] {
    const positions: Position[] = [];
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] === type) positions.push({ x, y });
      }
    }
    return positions;
  }

  const isValidMove = (map: number[][], x: number, y: number, isGhost = false): boolean => {
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;
    const tile = map[y][x];
    if (tile === TileType.WALL) return false;
    if (isGhost && tile === TileType.GHOST_SPAWN) return true; // Ghosts can enter spawn
    if (!isGhost && tile === TileType.DOOR) return false; // Pacman can't enter ghost house
    return true;
  };

  const getNextPosition = (x: number, y: number, dir: Direction): Position => {
    let nextX = x;
    let nextY = y;
    switch (dir) {
      case Direction.UP: nextY -= 1; break;
      case Direction.DOWN: nextY += 1; break;
      case Direction.LEFT: nextX -= 1; break;
      case Direction.RIGHT: nextX += 1; break;
    }
    
    // Wrap around (Tunnel)
    if (nextX < 0) nextX = INITIAL_MAP[0].length - 1;
    if (nextX >= INITIAL_MAP[0].length) nextX = 0;
    
    return { x: nextX, y: nextY };
  };

  // --- Game Logic ---
  const updateGame = useCallback((timestamp: number) => {
    if (!stateRef.current || stateRef.current.status !== 'PLAYING') {
      requestRef.current = requestAnimationFrame(updateGame);
      return;
    }

    if (timestamp - lastTimeRef.current < SPEED_MS) {
      requestRef.current = requestAnimationFrame(updateGame);
      return;
    }
    lastTimeRef.current = timestamp;

    const current = { ...stateRef.current };

    // 1. Move Pacman
    // Input Expiry: If the next direction has been pending for too long without being valid, drop it.
    if (current.pacman.direction !== current.pacman.nextDirection) {
        if (Date.now() - lastInputTimeRef.current > 500) {
            current.pacman.nextDirection = current.pacman.direction;
        }
    }

    // Try next direction first
    let nextPos = getNextPosition(current.pacman.x, current.pacman.y, current.pacman.nextDirection);
    if (isValidMove(current.map, nextPos.x, nextPos.y)) {
      current.pacman.direction = current.pacman.nextDirection;
    } else {
      // Fallback to current direction
      nextPos = getNextPosition(current.pacman.x, current.pacman.y, current.pacman.direction);
    }

    if (isValidMove(current.map, nextPos.x, nextPos.y)) {
      current.pacman.x = nextPos.x;
      current.pacman.y = nextPos.y;
    }

    // 2. Interactions (Eating)
    const tileAtPacman = current.map[current.pacman.y][current.pacman.x];
    if (tileAtPacman === TileType.DOT) {
      current.score += 10;
      current.dotsEaten += 1;
      current.map[current.pacman.y][current.pacman.x] = TileType.EMPTY;
      soundManager.playChomp();

      // Spawn Fruit Logic
      if (current.dotsEaten > 0 && current.dotsEaten % DOTS_TO_SPAWN_FRUIT === 0) {
          current.map[FRUIT_SPAWN_POS.y][FRUIT_SPAWN_POS.x] = TileType.FRUIT;
          current.fruitTimer = FRUIT_DURATION;
      }

    } else if (tileAtPacman === TileType.POWER_PELLET) {
      current.score += 50;
      current.map[current.pacman.y][current.pacman.x] = TileType.EMPTY;
      current.powerModeTime = 50; // Ticks
      current.ghosts.forEach(g => g.isScared = true);
      soundManager.playPower();
    } else if (tileAtPacman === TileType.FRUIT) {
      current.score += FRUIT_POINTS;
      current.map[current.pacman.y][current.pacman.x] = TileType.EMPTY;
      current.fruitTimer = 0;
      soundManager.playFruit();
    }

    // Power Mode Countdown
    if (current.powerModeTime > 0) {
      current.powerModeTime--;
      if (current.powerModeTime === 0) {
        current.ghosts.forEach(g => g.isScared = false);
      }
    }

    // Fruit Timer Countdown
    if (current.fruitTimer > 0) {
        current.fruitTimer--;
        if (current.fruitTimer === 0) {
            // Remove fruit if present
            if (current.map[FRUIT_SPAWN_POS.y][FRUIT_SPAWN_POS.x] === TileType.FRUIT) {
                current.map[FRUIT_SPAWN_POS.y][FRUIT_SPAWN_POS.x] = TileType.EMPTY;
            }
        }
    }

    // 3. Move Ghosts
    current.ghosts = current.ghosts.map(ghost => {
        if (ghost.isDead) {
             // Simple respawn logic for now: teleport to center
             const center = findPosition(INITIAL_MAP, TileType.GHOST_SPAWN);
             if (center && ghost.x === center.x && ghost.y === center.y) {
                 return { ...ghost, isDead: false, isScared: false };
             }
             // Move towards center if dead (simplified AI)
             if (center) {
                 const dx = center.x - ghost.x;
                 const dy = center.y - ghost.y;
                 // Very basic homing
                 if (Math.abs(dx) > Math.abs(dy)) {
                    ghost.nextDirection = dx > 0 ? Direction.RIGHT : Direction.LEFT;
                 } else {
                    ghost.nextDirection = dy > 0 ? Direction.DOWN : Direction.UP;
                 }
             }
        } else {
            // Normal movement
            // Randomly choose a valid direction that isn't reversing if possible
            const options = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
            const validOptions = options.filter(dir => {
                 const p = getNextPosition(ghost.x, ghost.y, dir);
                 // Don't let ghosts turn around 180 immediately unless stuck
                 const isReverse = 
                    (dir === Direction.UP && ghost.direction === Direction.DOWN) ||
                    (dir === Direction.DOWN && ghost.direction === Direction.UP) ||
                    (dir === Direction.LEFT && ghost.direction === Direction.RIGHT) ||
                    (dir === Direction.RIGHT && ghost.direction === Direction.LEFT);
                 
                 return isValidMove(current.map, p.x, p.y, true) && (!isReverse || options.length === 1);
            });

            if (validOptions.length > 0) {
                // Simple AI: 20% chance to change direction at intersection, otherwise keep straight
                const goStraight = validOptions.includes(ghost.direction);
                if (goStraight && Math.random() > 0.3) {
                    ghost.nextDirection = ghost.direction;
                } else {
                    ghost.nextDirection = validOptions[Math.floor(Math.random() * validOptions.length)];
                }
            } else {
                 // Dead end (shouldn't happen in this map)
                 ghost.nextDirection = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].find(d => d !== ghost.direction) || Direction.UP;
            }
        }

        const gp = getNextPosition(ghost.x, ghost.y, ghost.nextDirection);
        if (isValidMove(current.map, gp.x, gp.y, true)) {
             ghost.direction = ghost.nextDirection;
             return { ...ghost, x: gp.x, y: gp.y };
        }
        return ghost;
    });


    // 4. Collision Checks (Pacman vs Ghost)
    const hitGhost = current.ghosts.find(g => g.x === current.pacman.x && g.y === current.pacman.y);
    if (hitGhost) {
        if (hitGhost.isScared && !hitGhost.isDead) {
            // Eat Ghost
            current.score += 200;
            hitGhost.isDead = true;
            hitGhost.isScared = false;
             // Respawn logic simplified: send back to box immediately for this version
             const spawn = findPosition(INITIAL_MAP, TileType.GHOST_SPAWN);
             if(spawn) {
                 hitGhost.x = spawn.x;
                 hitGhost.y = spawn.y;
             }
             soundManager.playGhostEat();
        } else if (!hitGhost.isDead) {
            // Pacman Dies
            soundManager.playDeath();
            current.lives--;
            if (current.lives <= 0) {
                current.status = 'GAME_OVER';
            } else {
                // Reset positions
                const pStart = findPosition(INITIAL_MAP, TileType.PACMAN_SPAWN);
                if (pStart) { current.pacman.x = pStart.x; current.pacman.y = pStart.y; }
                current.pacman.direction = Direction.RIGHT;
                current.pacman.nextDirection = Direction.RIGHT;
                lastInputTimeRef.current = Date.now(); // Reset buffer
                
                // Reset ghosts
                const gStarts = findAllPositions(INITIAL_MAP, TileType.GHOST_SPAWN);
                current.ghosts.forEach((g, i) => {
                    const s = gStarts[i % gStarts.length];
                    g.x = s.x;
                    g.y = s.y;
                    g.isScared = false;
                });
            }
        }
    }

    // 5. Check Win
    const dotsRemaining = current.map.flat().filter(c => c === TileType.DOT || c === TileType.POWER_PELLET).length;
    if (dotsRemaining === 0) {
        current.status = 'WON';
    }

    stateRef.current = current;
    setGameState(current);
    requestRef.current = requestAnimationFrame(updateGame);
  }, []);


  // Start Loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updateGame]);


  // Inputs
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!stateRef.current) return;
    
    if (stateRef.current.status === 'IDLE' || stateRef.current.status === 'GAME_OVER' || stateRef.current.status === 'WON') {
        if (e.key === 'Enter' || e.key === ' ') {
             initGame();
             soundManager.init();
             stateRef.current = { ...stateRef.current!, status: 'PLAYING' };
             setGameState(prev => prev ? { ...prev, status: 'PLAYING' } : null);
        }
        return;
    }

    let newDir: Direction = Direction.NONE;
    switch (e.key) {
      case 'ArrowUp': newDir = Direction.UP; break;
      case 'ArrowDown': newDir = Direction.DOWN; break;
      case 'ArrowLeft': newDir = Direction.LEFT; break;
      case 'ArrowRight': newDir = Direction.RIGHT; break;
    }

    if (newDir !== Direction.NONE) {
      stateRef.current.pacman.nextDirection = newDir;
      lastInputTimeRef.current = Date.now();
    }
  }, [initGame]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Mobile Controls
  const handleDirection = (dir: Direction) => {
      if (stateRef.current && stateRef.current.status === 'PLAYING') {
          stateRef.current.pacman.nextDirection = dir;
          lastInputTimeRef.current = Date.now();
      }
  };
  
  const toggleGame = () => {
      soundManager.init();
      if (stateRef.current?.status === 'IDLE' || stateRef.current?.status === 'GAME_OVER' || stateRef.current?.status === 'WON') {
        initGame();
        stateRef.current!.status = 'PLAYING';
        setGameState({ ...stateRef.current! });
      }
  };

  const toggleMute = () => {
      const muted = soundManager.toggleMute();
      setIsMuted(muted);
  };

  if (!gameState) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-['Press_Start_2P']">
      
      {/* Header */}
      <div className="w-full max-w-lg flex justify-between items-end mb-4 px-2">
        <div>
            <h1 className="text-2xl text-yellow-400 drop-shadow-md mb-2">PAC-MAN</h1>
            <div className="flex items-center gap-4">
                <div className="text-sm text-slate-400">HIGH SCORE: <span className="text-white">{highScore}</span></div>
            </div>
        </div>
        <div className="text-right">
             <div className="flex justify-end items-center gap-3 mb-1">
                <div className="text-xl">SCORE: <span className="text-pink-400">{gameState.score}</span></div>
                <button onClick={toggleMute} className="text-slate-400 hover:text-white">
                    {isMuted ? <SpeakerXMarkIcon className="w-6 h-6" /> : <SpeakerWaveIcon className="w-6 h-6" />}
                </button>
             </div>
             <div className="flex gap-1 justify-end">
                 {Array.from({length: Math.max(0, gameState.lives)}).map((_, i) => (
                     <div key={i} className="w-4 h-4 bg-yellow-400 rounded-full" style={{clipPath: 'polygon(100% 70%, 50% 50%, 100% 30%, 100% 0, 0 0, 0 100%, 100% 100%)'}}></div>
                 ))}
             </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative w-full max-w-lg aspect-[19/20]">
        <Grid map={gameState.map} pacman={gameState.pacman} ghosts={gameState.ghosts} />
        
        {/* Overlay Messages */}
        {gameState.status !== 'PLAYING' && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-lg">
                {gameState.status === 'IDLE' && (
                    <>
                        <div className="text-yellow-400 text-4xl mb-8 animate-bounce">READY!</div>
                        <button 
                            onClick={toggleGame}
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-sm border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all"
                        >
                            START GAME
                        </button>
                    </>
                )}
                {gameState.status === 'GAME_OVER' && (
                    <>
                        <div className="text-red-500 text-4xl mb-4">GAME OVER</div>
                        <div className="text-white mb-2">SCORE: {gameState.score}</div>
                        {gameState.score >= highScore && gameState.score > 0 && (
                             <div className="text-yellow-400 mb-6 text-sm animate-pulse">NEW HIGH SCORE!</div>
                        )}
                        {!((gameState.score >= highScore) && gameState.score > 0) && <div className="mb-8"></div>}
                        
                        <button 
                            onClick={toggleGame}
                            className="px-6 py-3 bg-white text-red-600 hover:bg-gray-200 rounded-sm flex items-center gap-2"
                        >
                            <ArrowPathIcon className="w-5 h-5" /> RESTART
                        </button>
                    </>
                )}
                 {gameState.status === 'WON' && (
                    <>
                        <div className="text-green-400 text-4xl mb-4">YOU WIN!</div>
                        <div className="text-white mb-2">SCORE: {gameState.score}</div>
                         {gameState.score >= highScore && gameState.score > 0 && (
                             <div className="text-yellow-400 mb-6 text-sm animate-pulse">NEW HIGH SCORE!</div>
                        )}
                         {!((gameState.score >= highScore) && gameState.score > 0) && <div className="mb-8"></div>}

                        <button 
                            onClick={toggleGame}
                            className="px-6 py-3 bg-green-600 text-white hover:bg-green-500 rounded-sm"
                        >
                            PLAY AGAIN
                        </button>
                    </>
                )}
            </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="mt-8 grid grid-cols-3 gap-2 md:hidden w-48 h-48">
            <div></div>
            <button 
                className="bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
                onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.UP); }}
            >
                <ArrowUpIcon className="w-8 h-8 text-slate-400"/>
            </button>
            <div></div>
            
            <button 
                className="bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
                onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.LEFT); }}
            >
                <ArrowLeftIcon className="w-8 h-8 text-slate-400"/>
            </button>
            <button 
                className="bg-slate-800 rounded-full flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
                onClick={toggleGame}
            >
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            </button>
            <button 
                className="bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
                onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.RIGHT); }}
            >
                <ArrowRightIcon className="w-8 h-8 text-slate-400"/>
            </button>

            <div></div>
            <button 
                className="bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
                onPointerDown={(e) => { e.preventDefault(); handleDirection(Direction.DOWN); }}
            >
                <ArrowDownIcon className="w-8 h-8 text-slate-400"/>
            </button>
            <div></div>
      </div>
      
      {/* Instructions */}
      <div className="hidden md:block mt-6 text-slate-500 text-xs text-center">
        Use <span className="text-slate-300 border border-slate-600 px-1 rounded">ARROW KEYS</span> to move
      </div>
    </div>
  );
};

export default App;