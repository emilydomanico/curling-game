import { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';

interface Stone {
  id: number;
  color: 'red' | 'yellow';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

interface DraggingState {
  id: number;
}

export default function App() {
  const [stones, setStones] = useState<Stone[]>([]);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const nextId = useRef<number>(1);

  const redCount = stones.filter((s) => s.color === 'red').length;
  const yellowCount = stones.filter((s) => s.color === 'yellow').length;

  const resolveCollisions = (currentStones: Stone[], draggedId: number): Stone[] => {
    const resolved = [...currentStones];
    const draggedIdx = resolved.findIndex((s) => s.id === draggedId);
    if (draggedIdx === -1) return resolved;

    // Real proportions: House 12-ft diameter (144 inches), Stone ~11.5 inches (~8% of house width).
    // In our SVG layout, the house width is 60 units (from x=20 to x=80). A stone radius ~2.4% gives an accurate physical ratio.
    const stoneRadius = 2.4; 
    const aspectRatioY = 2; // Board is 1:2 (width:height)

    let hasOverlap = true;
    let iterations = 0;
    const maxIterations = 20;

    while (hasOverlap && iterations < maxIterations) {
      hasOverlap = false;
      const draggedObj = resolved[draggedIdx];

      for (let i = 0; i < resolved.length; i++) {
        if (i === draggedIdx) continue;
        const other = resolved[i];
        
        const dx = draggedObj.x - other.x;
        const dy = (draggedObj.y - other.y) / aspectRatioY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const minDist = stoneRadius * 2;

        if (dist < minDist && dist > 0.001) {
          hasOverlap = true;
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          
          // Move ONLY the dropped stone, keeping others completely immovable
          resolved[draggedIdx] = {
            ...draggedObj,
            x: draggedObj.x + nx * overlap,
            y: draggedObj.y + (ny * overlap) * aspectRatioY
          };
        }
      }
      iterations++;
    }
    return resolved;
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging || !boardRef.current) return;
    
    const boardRect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - boardRect.left) / boardRect.width) * 100;
    const y = ((e.clientY - boardRect.top) / boardRect.height) * 100;

    setStones((prev) =>
      prev.map((stone) =>
        stone.id === dragging.id ? { ...stone, x, y } : stone
      )
    );
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      setStones((prev) => {
        const draggedStone = prev.find(s => s.id === dragging.id);
        if (draggedStone) {
          const isOutside = 
            draggedStone.x < -10 || 
            draggedStone.x > 110 || 
            draggedStone.y < -10 || 
            draggedStone.y > 110;
            
          if (isOutside) {
            return prev.filter(s => s.id !== dragging.id);
          }
        }
        return resolveCollisions(prev, dragging.id);
      });
      setDragging(null);
    }
  }, [dragging]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = () => handlePointerUp();
    
    if (dragging) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  const spawnStone = (color: 'red' | 'yellow', e: React.PointerEvent<HTMLButtonElement>) => {
    if ((color === 'red' && redCount >= 8) || (color === 'yellow' && yellowCount >= 8)) return;
    if (!boardRef.current) return;
    
    const boardRect = boardRef.current.getBoundingClientRect();
    const id = nextId.current++;
    
    const x = ((e.clientX - boardRect.left) / boardRect.width) * 100;
    const y = ((e.clientY - boardRect.top) / boardRect.height) * 100;

    setStones((prev) => [...prev, { id, color, x, y }]);
    setDragging({ id });
  };

  const startDragExisting = (id: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragging({ id });
  };

  const StoneUI = ({ color, isDragging }: { color: 'red' | 'yellow', isDragging: boolean }) => (
    <div className={`w-full h-full rounded-full border-[2px] shadow-sm flex items-center justify-center 
      ${color === 'red' ? 'bg-red-500 border-red-800' : 'bg-yellow-400 border-yellow-700'}
      ${isDragging ? 'scale-[2] shadow-xl opacity-90 cursor-grabbing' : 'opacity-100 hover:scale-110 cursor-grab'} 
      transition-transform duration-100 pointer-events-none`}>
      <div className={`w-1/2 h-1/2 rounded-full border border-black/30 ${color === 'red' ? 'bg-red-600' : 'bg-yellow-500'}`} />
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden font-sans text-slate-100 select-none relative">
      
      {/* SIDEBAR - z-10 so board elements slide under it gracefully */}
      <div className="w-24 sm:w-32 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-6 shadow-xl z-10 shrink-0">
        
        {/* Vertically Centered Stone Dispensers */}
        <div className="flex flex-col gap-8 w-full px-2 my-auto">
          {/* Red Dispenser */}
          <button 
            onPointerDown={(e) => spawnStone('red', e)}
            disabled={redCount >= 8}
            className="flex flex-col items-center gap-2 group cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="w-10 h-10 sm:w-14 sm:h-14 relative">
              <StoneUI color="red" isDragging={false} />
            </div>
            <span className="text-xs font-semibold text-slate-400 group-hover:text-red-400">
              {8 - redCount} Left
            </span>
          </button>

          {/* Yellow Dispenser */}
          <button 
            onPointerDown={(e) => spawnStone('yellow', e)}
            disabled={yellowCount >= 8}
            className="flex flex-col items-center gap-2 group cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="w-10 h-10 sm:w-14 sm:h-14 relative">
              <StoneUI color="yellow" isDragging={false} />
            </div>
            <span className="text-xs font-semibold text-slate-400 group-hover:text-yellow-400">
              {8 - yellowCount} Left
            </span>
          </button>
        </div>

        {/* Clear Board Button */}
        <div className="pt-6">
          <button 
            onClick={() => setStones([])}
            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 transition-colors shadow-md group"
            title="Clear Board"
          >
            <RotateCcw className="w-5 h-5 group-hover:-rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* GAME BOARD AREA */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6 relative bg-slate-900">
        {stones.length === 0 && (
          <div className="absolute top-10 w-full text-center text-slate-500 text-sm pointer-events-none">
            Drag stones from the left panel onto the sheet.<br/>
            Drag off the sheet to remove.
          </div>
        )}
        
        {/* The Curling Sheet (1:2 Aspect Ratio constraints) */}
        <div 
          ref={boardRef}
          className="relative bg-white shadow-2xl rounded-sm w-full max-w-[400px] h-full max-h-[800px] border-4 border-slate-700 overflow-hidden touch-none"
          style={{ aspectRatio: '1/2' }}
        >
          {/* SVG Rink Details */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 10 100 200" preserveAspectRatio="xMidYMid meet">
            {/* Center Line */}
            <line x1="50" y1="10" x2="50" y2="210" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2, 2" />
            
            {/* Hog Line */}
            <line x1="0" y1="30" x2="100" y2="30" stroke="#ef4444" strokeWidth="1.5" />

            {/* Back Line */}
            <line x1="0" y1="180" x2="100" y2="180" stroke="#0f172a" strokeWidth="0.8" />
            
            {/* The House (Rings) */}
            <g transform="translate(50, 150)">
              {/* 12-foot ring (blue) */}
              <circle cx="0" cy="0" r="30" fill="#3b82f6" />
              {/* 8-foot ring (white) */}
              <circle cx="0" cy="0" r="20" fill="#ffffff" />
              {/* 4-foot ring (red) */}
              <circle cx="0" cy="0" r="10" fill="#ef4444" />
              {/* Button (white center) */}
              <circle cx="0" cy="0" r="3" fill="#ffffff" />
              {/* Center Pin */}
              <circle cx="0" cy="0" r="0.5" fill="#0f172a" />
            </g>
          </svg>

          {/* Render Active Stones (Placed on Board) */}
          {stones.map((stone) => {
            const isDragging = dragging?.id === stone.id;
            if (isDragging) return null; // Rendered in global overlay layer below for fluid cross-boundary tracking
            return (
              <div
                key={stone.id}
                onPointerDown={(e) => startDragExisting(stone.id, e)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20 touch-none"
                style={{
                  left: `${stone.x}%`,
                  top: `${stone.y}%`,
                  width: '4.8%',
                  aspectRatio: '1/1' 
                }}
              >
                <StoneUI color={stone.color} isDragging={false} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Drag Overlay Layer (z-50) ensures the dragged stone displays smoothly anywhere on screen */}
      {dragging && (() => {
        const draggedStone = stones.find(s => s.id === dragging.id);
        if (!draggedStone) return null;
        return (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 touch-none"
            style={{
              left: `${draggedStone.x}%`,
              top: `${draggedStone.y}%`,
              width: '4.8%',
              aspectRatio: '1/1'
            }}
          >
            <StoneUI color={draggedStone.color} isDragging={true} />
          </div>
        );
      })()}

    </div>
  );
}