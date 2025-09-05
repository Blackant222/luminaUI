import React from 'react';
import { MousePointer2, Paintbrush, Pen, Square, GitMerge, Sparkles, UploadCloud, Hand, Minus, MoveUpRight, Circle, Triangle, Star as StarIcon, Type, Camera } from 'lucide-react';
import { Tool } from './types';

// Custom icon for Auto-Style Product tool (Camera with magic sparkle overlay)
const AutoStyleIcon = () => (
  <div className="relative" style={{ width: 24, height: 24 }}>
    <Camera size={24} />
    <svg 
      width="12" 
      height="12" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="absolute -top-1 -right-1 text-yellow-400"
    >
      <path d="M12 3l2 5h5l-4 4 2 5-5-3-5 3 2-5-4-4h5l2-5z" />
    </svg>
  </div>
);

export const TOOLS = [
  { id: Tool.Select, name: 'Select', icon: <MousePointer2 size={24} />, shortcut: 'V' },
  { id: Tool.Hand, name: 'Hand', icon: <Hand size={24} />, shortcut: 'H' },
  { id: Tool.Frame, name: 'Frame', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4"/><path d="M2 12h4"/><path d="M12 2v4"/><path d="M12 22v-4"/><path d="M6 18H4v-2"/><path d="M18 6h2V4"/><path d="M6 6H4v2"/><path d="M18 18h2v-2"/></svg>, shortcut: 'F' },
  { id: Tool.Brush, name: 'Brush', icon: <Paintbrush size={24} />, shortcut: 'B' },
  { id: Tool.Pen, name: 'Pen', icon: <Pen size={24} />, shortcut: 'P' },
  { id: Tool.Text, name: 'Text', icon: <Type size={24} />, shortcut: 'T' },
  { id: Tool.Generate, name: 'Generate', icon: <Sparkles size={24} />, shortcut: 'G' },
  { id: Tool.Merge, name: 'Merge', icon: <GitMerge size={24} /> },
  { id: Tool.Upload, name: 'Upload', icon: <UploadCloud size={24} /> },
  { id: Tool.AutoStyle, name: 'Auto-Style Product', icon: <AutoStyleIcon /> },
];

export const SHAPE_TOOLS = [
  { id: Tool.Rectangle, name: 'Rectangle', icon: <Square size={24} />, shortcut: 'R' },
  { id: Tool.Line, name: 'Line', icon: <Minus size={24} />, shortcut: 'L' },
  { id: Tool.Arrow, name: 'Arrow', icon: <MoveUpRight size={24} /> },
  { id: Tool.Ellipse, name: 'Ellipse', icon: <Circle size={24} />, shortcut: 'O' },
  { id: Tool.Polygon, name: 'Polygon', icon: <Triangle size={24} /> },
  { id: Tool.Star, name: 'Star', icon: <StarIcon size={24} /> },
]

export const CURSOR_MAP: { [key in Tool]: string } = {
  [Tool.Select]: 'default',
  [Tool.Hand]: 'grab',
  [Tool.Brush]: 'crosshair',
  [Tool.Pen]: 'crosshair',
  [Tool.Frame]: 'crosshair',
  [Tool.Text]: 'text',
  [Tool.Merge]: 'default',
  [Tool.Generate]: 'default',
  [Tool.Upload]: 'default',
  [Tool.AutoStyle]: 'default',
  [Tool.Rectangle]: 'crosshair',
  [Tool.Line]: 'crosshair',
  [Tool.Arrow]: 'crosshair',
  [Tool.Ellipse]: 'crosshair',
  [Tool.Polygon]: 'crosshair',
  [Tool.Star]: 'crosshair',
  // Fix: Add missing Tool.Group to satisfy the type.
  [Tool.Group]: 'default',
};