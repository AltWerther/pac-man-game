import React, { useEffect, useRef } from 'react';
import { TileType, Entity, Direction } from '../types';
import { SPEED_MS } from '../constants';

interface GridProps {
  map: number[][];
  pacman: Entity;
  ghosts: Entity[];
}

const SmoothEntity: React.FC<{
  x: number;
  y: number;
  cols: number;
  rows: number;
  children: React.ReactNode;
  className?: string;
}> = ({ x, y, cols, rows, children, className }) => {
  const prevPos = useRef({ x, y });
  
  // Detect teleportation (tunneling) to disable transition
  const isTeleport = Math.abs(x - prevPos.current.x) > 1 || Math.abs(y - prevPos.current.y) > 1;

  useEffect(() => {
    prevPos.current = { x, y };
  }, [x, y]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${(x / cols) * 100}%`,
    top: `${(y / rows) * 100}%`,
    width: `${(1 / cols) * 100}%`,
    height: `${(1 / rows) * 100}%`,
    transition: isTeleport ? 'none' : `left ${SPEED_MS}ms linear, top ${SPEED_MS}ms linear`,
    zIndex: 10,
  };

  return (
    <div style={style} className={`flex items-center justify-center ${className || ''}`}>
      {children}
    </div>
  );
};

const Grid: React.FC<GridProps> = ({ map, pacman, ghosts }) => {
  const rows = map.length;
  const cols = map[0].length;

  const renderPacman = () => {
    const rotationMap = {
        [Direction.UP]: '-rotate-90',
        [Direction.DOWN]: 'rotate-90',
        [Direction.LEFT]: 'rotate-180',
        [Direction.RIGHT]: 'rotate-0',
        [Direction.NONE]: 'rotate-0',
    };

    return (
        <SmoothEntity x={pacman.x} y={pacman.y} cols={cols} rows={rows}>
             <div className={`w-[80%] h-[80%] bg-yellow-400 rounded-full relative ${rotationMap[pacman.direction]}`}>
                <div className="absolute top-1/4 right-1/4 w-[20%] h-[20%] bg-black rounded-full z-10"></div>
                <div 
                    className="absolute top-0 right-0 w-full h-full bg-slate-900" 
                    style={{ clipPath: 'polygon(100% 70%, 50% 50%, 100% 30%)' }}
                ></div>
             </div>
        </SmoothEntity>
    );
  };

  const renderGhost = (ghost: Entity) => {
      const color = ghost.isScared ? '#3b82f6' : ghost.color;
      return (
        <SmoothEntity key={ghost.id} x={ghost.x} y={ghost.y} cols={cols} rows={rows}>
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
                <div className="absolute bottom-0 w-full flex justify-between px-[10%]">
                        <div className="w-1 h-1 bg-inherit rounded-full translate-y-0.5"></div>
                        <div className="w-1 h-1 bg-inherit rounded-full translate-y-0.5"></div>
                        <div className="w-1 h-1 bg-inherit rounded-full translate-y-0.5"></div>
                </div>
            </div>
        </SmoothEntity>
      );
  };

  const renderStaticTile = (type: number, x: number, y: number) => {
    const cellClass = "w-full h-full flex items-center justify-center relative";
    
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
  
      let cellContent = null;
      if (type === TileType.DOT) {
        cellContent = <div className="w-[20%] h-[20%] bg-pink-200 rounded-full shadow-[0_0_4px_#fbcfe8]"></div>;
      } else if (type === TileType.POWER_PELLET) {
        cellContent = <div className="w-[50%] h-[50%] bg-pink-100 rounded-full animate-pulse shadow-[0_0_8px_#fff]"></div>;
      } else if (type === TileType.FRUIT) {
        cellContent = (
          <div className="w-[60%] h-[60%] relative animate-bounce">
              <div className="absolute bottom-0 right-0 w-[70%] h-[70%] bg-red-500 rounded-full shadow-sm"></div>
              <div className="absolute bottom-0 left-0 w-[70%] h-[70%] bg-red-600 rounded-full shadow-sm"></div>
              <div className="absolute top-0 left-1/2 w-[20%] h-[40%] bg-green-600 rounded-full -translate-x-1/2"></div>
          </div>
        );
      }
  
      return (
        <div key={`${x}-${y}`} className={cellClass}>
          {cellContent}
        </div>
      );
  };

  return (
    <div 
        className="relative bg-slate-900 border-4 border-slate-800 rounded-lg overflow-hidden shadow-2xl"
        style={{ aspectRatio: `${cols}/${rows}` }}
    >
        {/* Layer 1: Static Grid */}
        <div 
            className="grid w-full h-full"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
             {map.map((row, y) => row.map((cell, x) => renderStaticTile(cell, x, y)))}
        </div>

        {/* Layer 2: Dynamic Entities */}
        {renderPacman()}
        {ghosts.map(renderGhost)}
    </div>
  );
};

export default Grid;