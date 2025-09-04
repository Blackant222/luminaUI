import React, { useState } from 'react';

type TooltipProps = {
  content: string;
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
};

const Tooltip: React.FC<TooltipProps> = ({ content, shortcut, side = 'top', children }) => {
  const [isVisible, setIsVisible] = useState(false);

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute ${sideClasses[side]} z-50 p-0 flex items-center bg-black/80 backdrop-blur-sm rounded-md shadow-lg whitespace-nowrap transition-opacity duration-200`}
        >
          <span className="px-2 py-1 text-xs text-white/90">{content}</span>
          {shortcut && (
            <span className="px-1.5 py-0.5 text-xs text-white/60 border-l border-white/20">
              {shortcut}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
