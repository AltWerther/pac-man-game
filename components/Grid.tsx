import React from 'react';
import { TileType, Entity, Direction } from '../types';

interface GridProps {
  map: number[][];
  pacman: Entity;
  ghosts: Entity[];
}

const Grid: React.FC<GridProps> = ({ map, pacman, ghosts }) => {
  const renderTile = (type: number, x: number, y: number) => {
    // Check for entities at this position
    const ghost = ghosts.find(g => g.x === x && g.y === y);
    const isPacman = pacman.x === x && pacman.y === y;

    // Base cell style
    let cellContent = null;
    const cellClass = "w-full h-full flex items-center justify-center relative";

    // Render Entities (Layered on top)
    if (isPacman) {
        const rotationMap = {
            [Direction.UP]: '-rotate-90',
            [Direction.DOWN]: 'rotate-90',
            [Direction.LEFT]: 'rotate-180',
            [Direction.RIGHT]: 'rotate-0',
            [Direction.NONE]: 'rotate-0',
        };
        
        return (
            <div key={`${x}-${y}`} className={`${cellClass}`}>
                 <div className={`w-[80%] h-[80%] bg-yellow-400 rounded-full relative animate-pulse ${rotationMap[pacman.direction]}`}>
                    <div className="absolute top-1/4 right-1/4 w-[20%] h-[20%] bg-black rounded-full z-10"></div>
                    {/* Mouth using clip-path for simplicity */}
                    <div 
                        className="absolute top-0 right-0 w-full h-full bg-slate-900" 
                        style={{ clipPath: 'polygon(100% 70%, 50% 50%, 100% 30%)' }}
                    ></div>
                 </div>
            </div>
        );
    }

    if (ghost) {
        const color = ghost.isScared ? '#3b82f6' : ghost.color;
        return (
            <div key={`${x}-${y}`} className={cellClass}>
                <div 
                    className="w-[80%] h-[80%] rounded-t-full relative transition-colors duration-300"
                    style={{ backgroundColor: color }}
                >
                    {!ghost.isScared && (
                        <>
                            <div className="absolute top-1/4 left-1/4 w-[30%] h-[30%] bg-white rounded-full">
                                <div className="absolute top-1/2 right-1/4 w-[40%] h-[40%] bg-blue-900 rounded-full"></div>
                            </div>
                            <div className="absolute top-1/4 right-1/4 w-[30%] h-[30%] bg-white rounded-full">
                                 <div className="absolute top-1/2 right-1/4 w-[40%] h-[40%] bg-blue-900 rounded-full"></div>
                            </div>
                        </>
                    )}
                     {ghost.isScared && (
                        <div className="absolute top-1/2 left-0 w-full text-[8px] text-white text-center leading-none">
                            ~
                        </div>
                    )}
                     {/* Little feet */}
                    <div className="absolute bottom-0 w-full flex justify-between px-[10%]">
                         <div className="w-1 h-1 bg-inherit rounded-full translate-y-0.5"></div>
                         <div className="w-1 h-1 bg-inherit rounded-full translate-y-0.5"></div>
                         <div className="w-1 h-1 bg-inherit rounded-full translate-y-0.5"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Render Static Map Elements
    if (type === TileType.WALL) {
      return (
        <div key={`${x}-${y}`} className={`${cellClass} bg-blue-900/30 border-[0.5px] border-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.3)] rounded-sm`}>
             <div className="w-1/2 h-1/2 border border-blue-800/50 rounded-sm"></div>
        </div>
      );
    } 
    
    if (type === TileType.DOOR) {
        return (
          <div key={`${x}-${y}`} className={`${cellClass}`}>
            <div className="w-full h-[2px] bg-pink-400/50"></div>
          </div>
        );
    }

    if (type === TileType.DOT) {
      cellContent = <div className="w-[20%] h-[20%] bg-pink-200 rounded-full shadow-[0_0_4px_#fbcfe8]"></div>;
    } else if (type === TileType.POWER_PELLET) {
      cellContent = <div className="w-[50%] h-[50%] bg-pink-100 rounded-full animate-pulse shadow-[0_0_8px_#fff]"></div>;
    }

    return (
      <div key={`${x}-${y}`} className={cellClass}>
        {cellContent}
      </div>
    );
  };

  return (
    <div 
        className="grid gap-0 bg-slate-900 border-4 border-slate-800 rounded-lg overflow-hidden shadow-2xl"
        style={{
            gridTemplateColumns: `repeat(${map[0].length}, minmax(0, 1fr))`,
            aspectRatio: `${map[0].length}/${map.length}`
        }}
    >
      {map.map((row, y) => row.map((cell, x) => renderTile(cell, x, y)))}
    </div>
  );
};

export default Grid;