import React, { useEffect, useRef } from 'react';
import { ContextMenuItem } from '../types';

type ContextMenuProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    top: y,
    left: x,
    position: 'fixed',
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-48 bg-white/10 backdrop-blur-xl rounded-lg border border-white/10 shadow-lg p-1.5"
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            if (item.disabled) return;
            item.action();
            onClose();
          }}
          disabled={item.disabled}
          className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm text-white/90 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {item.icon && <span className="text-white/70">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;