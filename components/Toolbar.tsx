import React, { useState, useMemo } from 'react';
import { Tool } from '../types';
import { TOOLS, SHAPE_TOOLS } from '../constants';
import { LogOut, Home, Save } from 'lucide-react';
import Tooltip from './Tooltip';

type ToolbarProps = {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onLogout: () => void;
  onExit: () => void;
  onSave: () => void;
  isSaving: boolean;
  color: string;
  setColor: (color: string) => void;
};

const ShapeToolGroup: React.FC<{
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
}> = ({ activeTool, setActiveTool }) => {
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [flyoutPosition, setFlyoutPosition] = useState({ right: true, top: true });

  const activeShapeTool = useMemo(() => {
    return SHAPE_TOOLS.find(t => t.id === activeTool) || SHAPE_TOOLS[0];
  }, [activeTool]);

  const isShapeToolActive = useMemo(() => {
    return SHAPE_TOOLS.some(t => t.id === activeTool);
  }, [activeTool]);

  // Handle mouse enter with position calculation
  const handleMouseEnter = (e: React.MouseEvent) => {
    // Calculate if dropdown would go off screen
    const toolbarRect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 45; // Reduced from 56px (approx 20% smaller)
    const dropdownHeight = SHAPE_TOOLS.length * 32 + 8; // Reduced from 40px to 32px (20% smaller)
    
    const wouldOverflowRight = toolbarRect.right + dropdownWidth > window.innerWidth;
    const wouldOverflowBottom = toolbarRect.top + dropdownHeight > window.innerHeight;
    
    setFlyoutPosition({
      right: !wouldOverflowRight,
      top: !wouldOverflowBottom
    });
    
    setIsFlyoutOpen(true);
  };

  // Handle mouse leave with delay to prevent flickering
  const handleMouseLeave = () => {
    // Add a small delay to prevent flickering when moving between buttons
    setTimeout(() => {
      setIsFlyoutOpen(false);
    }, 150);
  };

  // Handle mouse enter on dropdown to keep it open
  const handleDropdownMouseEnter = () => {
    setIsFlyoutOpen(true);
  };

  // Handle mouse leave on dropdown
  const handleDropdownMouseLeave = () => {
    setIsFlyoutOpen(false);
  };

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Tooltip content={activeShapeTool.name} shortcut={activeShapeTool.shortcut} side="right">
        <button
          onClick={() => setActiveTool(activeShapeTool.id)}
          className={`p-2 rounded-lg transition-all duration-200 ${
            isShapeToolActive
              ? 'bg-[#6D35FF] text-white shadow-md'
              : 'text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          {activeShapeTool.icon}
        </button>
      </Tooltip>
      {isFlyoutOpen && (
        <div 
          className={`absolute ${flyoutPosition.right ? 'left-full ml-2' : 'right-full mr-2'} ${flyoutPosition.top ? 'top-0' : 'bottom-0'} bg-white/10 backdrop-blur-xl rounded-lg border border-white/10 p-1 flex flex-col gap-1 shadow-lg`}
          onMouseEnter={handleDropdownMouseEnter}
          onMouseLeave={handleDropdownMouseLeave}
        >
          {SHAPE_TOOLS.map(tool => (
             <Tooltip key={tool.id} content={tool.name} shortcut={tool.shortcut} side="right">
              <button
                onClick={() => {
                    setActiveTool(tool.id);
                    setIsFlyoutOpen(false);
                }}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  activeTool === tool.id
                    ? 'bg-[#6D35FF] text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tool.icon}
              </button>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setActiveTool, onLogout, onExit, onSave, isSaving, color, setColor }) => {
  const toolsWithColor = [Tool.Pen, Tool.Rectangle, Tool.Line, Tool.Arrow, Tool.Ellipse, Tool.Polygon, Tool.Star];

  return (
    <aside className="absolute top-1/2 left-6 -translate-y-1/2 z-10">
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-1.5 flex flex-col items-center gap-1.5 shadow-lg">
        <Tooltip content="Dashboard" shortcut="Esc" side="right">
            <button
              onClick={onExit}
              className="p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Home size={20} />
            </button>
        </Tooltip>
        <div className="w-full h-px bg-white/10 my-1"></div>
        <Tooltip content={isSaving ? "Saving..." : "Save Project"} side="right">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isSaving
                ? 'bg-white/10 text-white/50 cursor-not-allowed'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Save size={20} />
          </button>
        </Tooltip>
        <div className="w-full h-px bg-white/10 my-1"></div>
        {TOOLS.map((tool) => (
          <Tooltip key={tool.id} content={tool.name} shortcut={tool.shortcut} side="right">
            <button
              onClick={() => setActiveTool(tool.id)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                activeTool === tool.id
                  ? 'bg-[#6D35FF] text-white shadow-md'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tool.icon}
            </button>
          </Tooltip>
        ))}
        <ShapeToolGroup activeTool={activeTool} setActiveTool={setActiveTool} />
        <div className="w-full h-px bg-white/10 my-1"></div>
        {toolsWithColor.includes(activeTool) && (
          <>
            <div className="p-1.5 relative">
              <Tooltip content="Color" side="right">
                <label htmlFor="color-picker" className="cursor-pointer">
                  <div className="w-5 h-5 rounded-full border-2 border-white/50" style={{ backgroundColor: color }} />
                </label>
              </Tooltip>
              <input
                id="color-picker"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute w-0 h-0 top-0 left-0 opacity-0"
              />
            </div>
            <div className="w-full h-px bg-white/10 my-1"></div>
          </>
        )}
        <Tooltip content="Logout" side="right">
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={20} />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
};

export default Toolbar;
