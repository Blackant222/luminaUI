import React, { useState, useCallback, useRef, MouseEvent, useEffect, DragEvent, WheelEvent, ChangeEvent, forwardRef, memo, KeyboardEvent } from 'react';
import { Undo, Wand2, MessageSquareText } from 'lucide-react';
import { Tool, CanvasElement, FrameElement, ImageElement, Point, DrawingElement, ShapeElement, Interaction, ContextMenuItem, TextElement, CanvasState, CanvasAction } from '../types';
import { CURSOR_MAP } from '../constants';
import * as geminiService from '../services/geminiService';
import Spinner from './Spinner';
import AIPromptBar from './AIPromptBar';
import ContextMenu from './ContextMenu';
import PromptModal from './PromptModal';
import { BringToFront, SendToBack, Copy, Trash2, BoxSelect, Maximize } from 'lucide-react';

const getPolygonPoints = (centerX: number, centerY: number, radius: number, sides: number) => {
    const points = [];
    for (let i = 0; i < sides; i++) {
        points.push({
            x: centerX + radius * Math.cos(2 * Math.PI * i / sides - Math.PI / 2),
            y: centerY + radius * Math.sin(2 * Math.PI * i / sides - Math.PI / 2),
        });
    }
    return points;
};

const getStarPoints = (centerX: number, centerY: number, outerRadius: number, innerRadius: number, points: number) => {
    const starPoints = [];
    const angle = Math.PI / points;
    for (let i = 0; i < 2 * points; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        starPoints.push({
            x: centerX + radius * Math.cos(i * angle - Math.PI / 2),
            y: centerY + radius * Math.sin(i * angle - Math.PI / 2),
        });
    }
    return starPoints;
};

const Handle: React.FC<{ onMouseDown: (e: MouseEvent) => void, cursor: string, style: React.CSSProperties }> = ({ onMouseDown, cursor, style }) => {
  return <div style={{...style, cursor}} onMouseDown={onMouseDown} />;
};

const ElementRenderer = memo(forwardRef<HTMLDivElement, { 
  element: CanvasElement; 
  allElements: CanvasElement[];
  selectedElementIds: string[];
  editingElementId: string | null;
  elementBeingCreatedId: string | null;
  expandingElementId: string | null;
  onMouseDown: (e: MouseEvent, id: string) => void;
  onDoubleClick: (e: MouseEvent, id: string) => void;
  onContextMenu: (e: MouseEvent, id: string) => void;
  onBrushStart: (e: MouseEvent, element: ImageElement) => void;
  onResizeStart: (e: MouseEvent, element: CanvasElement, handle: string) => void;
  onExpandStart: (e: MouseEvent, element: ImageElement, handle: string) => void;
  onUpdateText: (id: string, content: string) => void;
  activeTool: Tool;
  viewZoom: number;
}>(({ element, allElements, selectedElementIds, editingElementId, elementBeingCreatedId, expandingElementId, onMouseDown, onDoubleClick, onContextMenu, onBrushStart, onResizeStart, onExpandStart, onUpdateText, activeTool, viewZoom }, ref) => {
  
  const parent = element.parentId ? allElements.find(el => el.id === element.parentId) : null;
  const relativeX = parent ? element.x - parent.x : element.x;
  const relativeY = parent ? element.y - parent.y : element.y;
  
  const isSelected = selectedElementIds.includes(element.id) && element.id !== elementBeingCreatedId;
  const isEditing = editingElementId === element.id;
  const isExpanding = expandingElementId === element.id;
  const isDrawing = element.type === 'drawing';

  const style: React.CSSProperties = {
    position: 'absolute',
    left: relativeX,
    top: relativeY,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
    outline: isSelected ? `2px ${isDrawing ? 'dashed' : 'solid'} #6D35FF` : (isExpanding ? `2px dashed #6D35FF` : 'none'),
    outlineOffset: '4px',
    transition: 'outline 0.1s ease-in-out',
    userSelect: 'none',
    overflow: element.type === 'frame' ? 'hidden' : 'visible',
  };
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
    }
  }, [isEditing]);
  
  const handleTextBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    onUpdateText(element.id, e.target.value);
  };
  
  const handleTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') e.currentTarget.blur();
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (activeTool === Tool.Select || activeTool === Tool.Hand) {
      e.stopPropagation();
      onMouseDown(e, element.id);
    } else if (activeTool === Tool.Brush && element.type === 'image') {
      e.stopPropagation();
      onBrushStart(e, element);
    }
  }

  const renderElementContent = () => {
    switch (element.type) {
      case 'frame':
        const children = allElements.filter(el => el.parentId === element.id).sort((a,b) => a.zIndex - b.zIndex);
        return <div style={{width: '100%', height: '100%', backgroundColor: element.backgroundColor, border: '1px solid rgba(255,255,255,0.2)', position: 'relative'}}>
            {children.map(child => (
              <ElementRenderer
                  key={child.id}
                  element={child}
                  allElements={allElements}
                  selectedElementIds={selectedElementIds}
                  editingElementId={editingElementId}
                  elementBeingCreatedId={elementBeingCreatedId}
                  expandingElementId={expandingElementId}
                  onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}
                  onBrushStart={onBrushStart} onResizeStart={onResizeStart} onExpandStart={onExpandStart}
                  onUpdateText={onUpdateText} activeTool={activeTool} viewZoom={viewZoom}
                />
            ))}
        </div>;
      case 'image':
        return <img src={element.src} alt="canvas element" style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px'}} draggable="false" />;
      case 'text':
        if (isEditing) {
            return (
                <textarea
                    ref={textareaRef}
                    defaultValue={element.content}
                    onBlur={handleTextBlur}
                    onKeyDown={handleTextKeyDown}
                    style={{
                        width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none',
                        resize: 'none', color: element.color, fontSize: element.fontSize, fontFamily: element.fontFamily,
                        padding: 0, margin: 0, boxSizing: 'border-box', lineHeight: 1.2,
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
            )
        }
        return <div style={{
            width: '100%', height: '100%', color: element.color, fontSize: element.fontSize, fontFamily: element.fontFamily,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.2
        }}>{element.content}</div>;
      case 'drawing':
        return (
          <svg width={element.width} height={element.height} viewBox={`0 0 ${element.width} ${element.height}`} style={{overflow: 'visible', position: 'absolute', top: 0, left: 0}}>
            <path d={element.d} stroke={element.strokeColor} strokeWidth={element.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'shape':
        const { shapeType, strokeColor, strokeWidth, fillColor, flipHorizontal, flipVertical } = element;
        const halfStroke = strokeWidth / 2;
        const lineX1 = flipHorizontal ? element.width : 0;
        const lineY1 = flipVertical ? element.height : 0;
        const lineX2 = flipHorizontal ? 0 : element.width;
        const lineY2 = flipVertical ? 0 : element.height;
        return (
          <svg width={element.width} height={element.height} viewBox={`${-halfStroke} ${-halfStroke} ${element.width + strokeWidth} ${element.height + strokeWidth}`} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
            {shapeType === 'rectangle' && <rect x="0" y="0" width={element.width} height={element.height} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />}
            {shapeType === 'ellipse' && <ellipse cx={element.width/2} cy={element.height/2} rx={element.width/2} ry={element.height/2} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />}
            {shapeType === 'line' && <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} stroke={strokeColor} strokeWidth={strokeWidth} />}
            {shapeType === 'arrow' && <>
              <defs>
                <marker id={`arrowhead-${element.id}`} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
                </marker>
              </defs>
              <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} stroke={strokeColor} strokeWidth={strokeWidth} markerEnd={`url(#arrowhead-${element.id})`} />
            </>}
            {shapeType === 'polygon' && <polygon points={getPolygonPoints(element.width/2, element.height/2, Math.min(element.width, element.height)/2, 6).map(p => `${p.x},${p.y}`).join(' ')} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />}
            {shapeType === 'star' && <polygon points={getStarPoints(element.width/2, element.height/2, Math.min(element.width, element.height)/2, Math.min(element.width, element.height)/4, 5).map(p => `${p.x},${p.y}`).join(' ')} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />}
          </svg>
        )
      default:
        return null;
    }
  }
  
  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: '10px',
    height: '10px',
    backgroundColor: '#6D35FF',
    border: '1px solid white',
    borderRadius: '50%',
  };

  const resizeHandles = {
    'top-left': { ...handleStyle, top: '-5px', left: '-5px', cursor: 'nwse-resize' },
    'top-right': { ...handleStyle, top: '-5px', right: '-5px', cursor: 'nesw-resize' },
    'bottom-left': { ...handleStyle, bottom: '-5px', left: '-5px', cursor: 'nesw-resize' },
    'bottom-right': { ...handleStyle, bottom: '-5px', right: '-5px', cursor: 'nwse-resize' }
  };
  
  const expandHandles = {
      ...resizeHandles,
      'top': { ...handleStyle, top: '-5px', left: 'calc(50% - 5px)', cursor: 'n-resize' },
      'bottom': { ...handleStyle, bottom: '-5px', left: 'calc(50% - 5px)', cursor: 's-resize' },
      'left': { ...handleStyle, top: 'calc(50% - 5px)', left: '-5px', cursor: 'w-resize' },
      'right': { ...handleStyle, top: 'calc(50% - 5px)', right: '-5px', cursor: 'e-resize' },
  }

  return (
    <div ref={ref} style={style} onMouseDown={handleMouseDown} onDoubleClick={(e) => {e.stopPropagation(); onDoubleClick(e, element.id)}} onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, element.id);}} data-element-id={element.id}>
      {renderElementContent()}
      {element.isLoading && (
        <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'}}>
          <Spinner />
        </div>
      )}
       {isSelected && activeTool === Tool.Select && !element.isLoading && !isDrawing && (
        <>
          {Object.entries(resizeHandles).map(([handle, style]) => (
            <Handle key={handle} cursor={style.cursor as string} style={style} onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, element, handle); }}/>
          ))}
        </>
      )}
       {isExpanding && (
          <>
            {Object.entries(expandHandles).map(([handle, style]) => (
                <Handle key={handle} cursor={style.cursor as string} style={style} onMouseDown={(e) => { e.stopPropagation(); onExpandStart(e, element as ImageElement, handle); }}/>
            ))}
          </>
       )}
    </div>
  );
}));
  
type BrushState = {
  element: ImageElement;
  maskCanvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  screenPointsStrokes: Point[][];
} | null;

type AiEditModalState = {
    isOpen: boolean;
    elementToEdit: CanvasElement | null;
}

type ViewState = { pan: Point; zoom: number };

const isPointInElement = (point: Point, element: CanvasElement) => {
    return (
      point.x >= element.x &&
      point.x <= element.x + element.width &&
      point.y >= element.y &&
      point.y <= element.y + element.height
    );
};

const getTopmostFrameAtPoint = (point: Point, elements: CanvasElement[]): FrameElement | null => {
    const frames = elements
        .filter((el): el is FrameElement => el.type === 'frame' && isPointInElement(point, el))
        .sort((a, b) => b.zIndex - a.zIndex);
    return frames[0] || null;
};

const SHAPE_DRAWING_TOOLS = [Tool.Rectangle, Tool.Ellipse, Tool.Line, Tool.Arrow, Tool.Polygon, Tool.Star];
const FRAME_ONLY_TOOLS = [Tool.Pen, Tool.Text, ...SHAPE_DRAWING_TOOLS];

type CanvasProps = {
  activeTool: Tool;
  uploadTrigger: number;
  setActiveTool: (tool: Tool) => void;
  color: string;
  state: CanvasState;
  dispatch: React.Dispatch<CanvasAction>;
  undo: () => void;
  canUndo: boolean;
};


const Canvas: React.FC<CanvasProps> = ({ activeTool, uploadTrigger, setActiveTool, color, state, dispatch, undo, canUndo }) => {
  const [view, setView] = useState<ViewState>({ pan: { x: 0, y: 0 }, zoom: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const interactionRef = useRef<Interaction>(null);

  const [brushState, setBrushState] = useState<BrushState>(null);
  const [globalIsLoading, setGlobalIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [aiEditModal, setAiEditModal] = useState<AiEditModalState>({ isOpen: false, elementToEdit: null });
  const [isOverFrameForDrawing, setIsOverFrameForDrawing] = useState(false);
  const [expandingElementId, setExpandingElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  const screenToWorld = useCallback((screenPoint: Point): Point => {
    return {
      x: (screenPoint.x - view.pan.x) / view.zoom,
      y: (screenPoint.y - view.pan.y) / view.zoom,
    };
  }, [view]);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(screenPos);
    setContextMenu(null);

    if (e.button !== 0 || interactionRef.current) return;
    
    if (isSpacePressed || activeTool === Tool.Hand) {
      interactionRef.current = { type: 'pan', startX: screenPos.x - view.pan.x, startY: screenPos.y - view.pan.y };
      return;
    }
    
    const targetIsCanvas = e.target === e.currentTarget;

    if (targetIsCanvas && activeTool === Tool.Select) {
      dispatch({ type: 'CLEAR_SELECTION' });
      setEditingElementId(null);
    };
    
    const parentFrame = getTopmostFrameAtPoint(worldPos, state.elements);
    const parentId = parentFrame?.id ?? null;

    if (FRAME_ONLY_TOOLS.includes(activeTool) && !parentId) return;
    
    const nextZIndex = state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1;

    if (activeTool === Tool.Frame) {
      const newElement: FrameElement = { id: crypto.randomUUID(), type: 'frame', parentId: null, x: worldPos.x, y: worldPos.y, width: 0, height: 0, rotation: 0, backgroundColor: 'white', zIndex: nextZIndex };
      interactionRef.current = { type: 'draw', elementType: 'frame', startX: worldPos.x, startY: worldPos.y, elementId: newElement.id, parentId: null, drawMode: 'corner' };
      dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
      dispatch({ type: 'CLEAR_SELECTION' });
    } else if (SHAPE_DRAWING_TOOLS.includes(activeTool)) {
       const shapeType = activeTool.toLowerCase() as ShapeElement['shapeType'];
       const drawMode = ['line', 'arrow'].includes(shapeType) ? 'line' : ['star', 'polygon'].includes(shapeType) ? 'center' : 'corner';
       const newElement: ShapeElement = { id: crypto.randomUUID(), type: 'shape', shapeType, parentId, x: worldPos.x, y: worldPos.y, width: 0, height: 0, rotation: 0, zIndex: nextZIndex, strokeColor: color, strokeWidth: 4, fillColor: 'transparent', flipHorizontal: false, flipVertical: false };
       interactionRef.current = { type: 'draw', elementType: 'shape', shapeType, startX: worldPos.x, startY: worldPos.y, elementId: newElement.id, parentId, drawMode };
       dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
       dispatch({ type: 'CLEAR_SELECTION' });
    } else if (activeTool === Tool.Text) {
        const newElement: TextElement = { id: crypto.randomUUID(), type: 'text', parentId, x: worldPos.x, y: worldPos.y, width: 160, height: 40, rotation: 0, zIndex: nextZIndex, content: 'Type something...', fontSize: 24, color: color, fontFamily: 'sans-serif' };
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
        setEditingElementId(newElement.id);
        setActiveTool(Tool.Select);
    } else if (activeTool === Tool.Pen) {
        const newElement: DrawingElement = { id: crypto.randomUUID(), type: 'drawing', parentId, x: worldPos.x, y: worldPos.y, width: 0, height: 0, rotation: 0, zIndex: nextZIndex, points: [{x: 0, y: 0}], d: `M 0 0`, strokeColor: color, strokeWidth: 4 };
        interactionRef.current = { type: 'pen', points: [worldPos], elementId: newElement.id, parentId };
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
        dispatch({ type: 'CLEAR_SELECTION' });
    }
  }, [activeTool, dispatch, isSpacePressed, view, screenToWorld, state.elements, setActiveTool, color]);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(screenPos);
    
    if (FRAME_ONLY_TOOLS.includes(activeTool)) setIsOverFrameForDrawing(getTopmostFrameAtPoint(worldPos, state.elements) !== null);
    else setIsOverFrameForDrawing(false);
    
    const currentInteraction = interactionRef.current;
    if (!currentInteraction) return;

    if (currentInteraction.type === 'brushing' && brushState) {
        const { ctx, screenPointsStrokes } = brushState;
        const currentStroke = screenPointsStrokes[screenPointsStrokes.length - 1];
        currentStroke.push(screenPos); ctx.lineTo(screenPos.x, screenPos.y); ctx.stroke();
        return;
    }
    
    if (currentInteraction.type === 'pan') {
      setView(v => ({ ...v, pan: { x: screenPos.x - currentInteraction.startX, y: screenPos.y - currentInteraction.startY } }));
      return;
    }

    if (currentInteraction.type === 'draw') {
      const { startX, startY, elementId, drawMode } = currentInteraction;
      let changes: Partial<ShapeElement> = {};
      if (drawMode === 'corner') {
          changes = { x: Math.min(startX, worldPos.x), y: Math.min(startY, worldPos.y), width: Math.abs(worldPos.x - startX), height: Math.abs(worldPos.y - startY) };
      } else if (drawMode === 'center') {
          const radius = Math.sqrt(Math.pow(worldPos.x - startX, 2) + Math.pow(worldPos.y - startY, 2));
          changes = { x: startX - radius, y: startY - radius, width: radius * 2, height: radius * 2 };
      } else if (drawMode === 'line') {
          changes = { 
              x: Math.min(startX, worldPos.x), y: Math.min(startY, worldPos.y), 
              width: Math.abs(worldPos.x - startX), height: Math.abs(worldPos.y - startY),
              flipHorizontal: worldPos.x < startX,
              flipVertical: worldPos.y < startY,
          };
      }
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes }], overwriteHistory: true } });
    } else if (currentInteraction.type === 'pen') {
        const { elementId, points } = currentInteraction;
        const newPoints = [...points, worldPos];
        interactionRef.current = { ...currentInteraction, points: newPoints };
        const minX = Math.min(...newPoints.map(p => p.x)); const minY = Math.min(...newPoints.map(p => p.y)); const maxX = Math.max(...newPoints.map(p => p.x)); const maxY = Math.max(...newPoints.map(p => p.y));
        const dForElement = newPoints.map((p, i) => `${i===0 ? 'M' : 'L'} ${p.x - minX} ${p.y - minY}`).join(' ');
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: { x: minX, y: minY, width: maxX - minX, height: maxY - minY, d: dForElement } }], overwriteHistory: true } });
    } else if (currentInteraction.type === 'move') {
      const { startViewX, startViewY, originalElements } = currentInteraction;
      const dx = worldPos.x - startViewX; const dy = worldPos.y - startViewY;
      const updates = originalElements.map(el => ({ id: el.id, changes: { x: el.x + dx, y: el.y + dy } }));
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates, overwriteHistory: true }});
    } else if (currentInteraction.type === 'resize' || currentInteraction.type === 'expand') {
      const { handle, originalElement } = currentInteraction;
      let { x, y, width, height } = originalElement;
      const dx = worldPos.x - currentInteraction.startX; const dy = worldPos.y - currentInteraction.startY;
      const aspectRatio = originalElement.width / originalElement.height;
      
      if (currentInteraction.type === 'resize') {
        if (handle === 'bottom-right') { width = originalElement.width + dx; height = width / aspectRatio; } 
        else if (handle === 'top-left') { width = originalElement.width - dx; height = width / aspectRatio; x = originalElement.x + dx; y = originalElement.y + (originalElement.width - width) / aspectRatio; } 
        else if (handle === 'top-right') { width = originalElement.width + dx; height = width / aspectRatio; y = originalElement.y - (width - originalElement.width) / aspectRatio; } 
        else if (handle === 'bottom-left') { width = originalElement.width - dx; height = width / aspectRatio; x = originalElement.x + dx; }
      } else {
        if (handle.includes('right')) { width = originalElement.width + dx; } if (handle.includes('left')) { width = originalElement.width - dx; x = originalElement.x + dx; }
        if (handle.includes('bottom')) { height = originalElement.height + dy; } if (handle.includes('top')) { height = originalElement.height - dy; y = originalElement.y + dy; }
      }

      if (width > 20 && height > 20) {
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: originalElement.id, changes: { x, y, width, height } }], overwriteHistory: true } });
      }
    }
  }, [dispatch, brushState, screenToWorld, activeTool, state.elements]);

  const handleMouseUp = useCallback(async (e: MouseEvent<HTMLDivElement>) => {
    const currentInteraction = interactionRef.current;
    if (!currentInteraction) return;

    if (currentInteraction.type === 'draw' || currentInteraction.type === 'pen') {
        dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [currentInteraction.elementId], shiftKey: false }});
    }

    if (currentInteraction.type === 'expand') {
      const element = state.elements.find(el => el.id === currentInteraction.originalElement.id) as ImageElement;
      if (element) {
        setGlobalIsLoading(true);
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: element.id, changes: { isLoading: true } }] } });
        try {
          const newImageSrc = await geminiService.expandImage(currentInteraction.originalElement, { width: element.width, height: element.height });
          dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: element.id, changes: { src: newImageSrc, isLoading: false, x: element.x, y: element.y, width: element.width, height: element.height } }] } });
        } catch (error) {
           console.error("Image expand failed:", error); alert("Sorry, the image expand failed. Please try again.");
           dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: currentInteraction.originalElement.id, changes: { ...currentInteraction.originalElement, isLoading: false } }] } });
        } finally {
          setGlobalIsLoading(false);
          setExpandingElementId(null);
        }
      }
    }
    
    interactionRef.current = null;
  }, [dispatch, state.elements]);

  const handleDoubleClick = useCallback((e: MouseEvent, id: string) => {
    const element = state.elements.find(el => el.id === id);
    if (element?.type === 'text') {
        setEditingElementId(id);
    }
  }, [state.elements]);
  
  const handleElementMouseDown = useCallback((e: MouseEvent, id: string) => {
    const worldPos = screenToWorld({x: e.clientX, y: e.clientY});
    setEditingElementId(null);
    dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [id], shiftKey: e.shiftKey } });
    
    if (activeTool === Tool.Select) {
      const newSelectedIds = e.shiftKey ? (state.selectedElementIds.includes(id) ? state.selectedElementIds.filter(sid => sid !== id) : [...state.selectedElementIds, id]) : [id];
      const elementsToMove = state.elements.filter(el => newSelectedIds.includes(el.id));
      interactionRef.current = { type: 'move', startViewX: worldPos.x, startViewY: worldPos.y, originalElements: elementsToMove };
    }
  }, [dispatch, screenToWorld, activeTool, state.elements, state.selectedElementIds]);

  const onResizeStart = useCallback((e: MouseEvent, element: CanvasElement, handle: string) => {
    const worldPos = screenToWorld({x: e.clientX, y: e.clientY});
    interactionRef.current = { type: 'resize', handle, startX: worldPos.x, startY: worldPos.y, originalElement: element };
  }, [screenToWorld]);

  const onExpandStart = useCallback((e: MouseEvent, element: ImageElement, handle: string) => {
    const worldPos = screenToWorld({x: e.clientX, y: e.clientY});
    interactionRef.current = { type: 'expand', handle, startX: worldPos.x, startY: worldPos.y, originalElement: element };
  }, [screenToWorld]);

  const handleBrushStart = useCallback((e: MouseEvent, element: ImageElement) => {
    e.stopPropagation();
    interactionRef.current = { type: 'brushing' };
    const screenPos = { x: e.clientX, y: e.clientY };
    let currentBrushState = brushState;
    if (!currentBrushState || currentBrushState.element.id !== element.id) {
        if (currentBrushState) document.body.removeChild(currentBrushState.maskCanvas);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = window.innerWidth; maskCanvas.height = window.innerHeight;
        Object.assign(maskCanvas.style, { position: 'fixed', top: '0', left: '0', pointerEvents: 'none', zIndex: '10000', cursor: 'crosshair' });
        document.body.appendChild(maskCanvas);
        const ctx = maskCanvas.getContext('2d')!;
        Object.assign(ctx, { strokeStyle: 'rgba(255, 255, 255, 0.7)', lineWidth: 40, lineCap: 'round', lineJoin: 'round' });
        currentBrushState = { element, maskCanvas, ctx, screenPointsStrokes: [] };
    }
    const { ctx, screenPointsStrokes } = currentBrushState;
    screenPointsStrokes.push([screenPos]);
    ctx.beginPath();
    ctx.moveTo(screenPos.x, screenPos.y);
    setBrushState(currentBrushState);
}, [brushState]);

const handleBrushSubmit = async (prompt: string) => {
  if (!brushState) return;
  const { element, maskCanvas } = brushState;
  const elementId = element.id;
  
  const finalMask = document.createElement('canvas');
  finalMask.width = element.width; finalMask.height = element.height;
  const finalCtx = finalMask.getContext('2d')!;
  finalCtx.fillStyle = 'black'; finalCtx.fillRect(0, 0, finalMask.width, finalMask.height);
  Object.assign(finalCtx, { strokeStyle: 'white', lineWidth: 40 / view.zoom, lineCap: 'round', lineJoin: 'round' });
  
  brushState.screenPointsStrokes.forEach(stroke => {
      if (stroke.length === 0) return;
      const relativePoints = stroke.map(p => screenToWorld(p)).map(p => ({ x: p.x - element.x, y: p.y - element.y }));
      finalCtx.beginPath(); finalCtx.moveTo(relativePoints[0].x, relativePoints[0].y);
      relativePoints.forEach(p => finalCtx.lineTo(p.x, p.y));
      finalCtx.stroke();
  });

  setGlobalIsLoading(true);
  dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: { isLoading: true } }] } });
  
  try {
      const maskData = finalMask.toDataURL('image/png');
      const newImageSrc = await geminiService.editImageWithMask(element.src, maskData, prompt);
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: { src: newImageSrc, isLoading: false } }] } });
  } catch (error) {
      console.error("Image edit failed:", error); alert("Sorry, the image edit failed. Please try again.");
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: { isLoading: false } }] } });
  } finally {
      setGlobalIsLoading(false);
      if (document.body.contains(maskCanvas)) document.body.removeChild(maskCanvas);
      setBrushState(null);
      setActiveTool(Tool.Select);
  }
};

const handleUpdateText = (id: string, content: string) => {
    dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id, changes: { content } }] }});
    setEditingElementId(null);
};

  const addImagesToCanvas = useCallback((files: File[]) => {
     const imagePromises = files.map((file, i) => {
         return new Promise<ImageElement>((resolve, reject) => {
             geminiService.fileToBase64(file)
                 .then(({ data, mimeType }) => {
                     const src = `data:${mimeType};base64,${data}`;
                     const img = new Image();
                     img.onload = () => {
                         const center = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                         const nextZIndex = state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1;
                         const newElement: ImageElement = { id: crypto.randomUUID(), type: 'image', src, parentId: null, x: center.x + i * 20 - (img.width > 512 ? 256 : img.width/2), y: center.y + i * 20 - (img.height > 512 ? (256 * img.height / img.width)/2 : img.height/2), width: img.width > 512 ? 512 : img.width, height: img.height > 512 ? (512 * img.height / img.width) : img.height, rotation: 0, zIndex: nextZIndex };
                         resolve(newElement);
                     };
                     img.onerror = reject; img.src = src;
                 }).catch(reject);
         });
     });
     Promise.all(imagePromises).then(newElements => { if (newElements.length > 0) dispatch({ type: 'ADD_ELEMENTS', payload: { elements: newElements }}); }).catch(error => { console.error("Error loading images:", error); alert("There was an error loading some of the images."); });
  }, [dispatch, screenToWorld, state.elements]);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (files.length > 0) addImagesToCanvas(files); }, [addImagesToCanvas]);
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')); if (files.length > 0) addImagesToCanvas(files); e.target.value = ''; };
  const handleAIGenerate = async (prompt: string) => { setGlobalIsLoading(true); try { const imageSrc = await geminiService.generateImage(prompt); const img = new Image(); img.onload = () => { const center = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); const nextZIndex = state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1; const newEl: ImageElement = { id: crypto.randomUUID(), type: 'image', src: imageSrc, parentId: null, x: center.x-img.width/2, y: center.y-img.height/2, width: img.width, height: img.height, rotation: 0, zIndex: nextZIndex }; dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newEl] }}); }; img.src = imageSrc; } catch (error) { console.error("Image generation failed:", error); alert("Sorry, image generation failed. Please try again."); } finally { setGlobalIsLoading(false); } };
  const handleAIMerge = async (prompt: string) => { const selectedIds = state.selectedElementIds; const elementsToMerge = state.elements.filter((el): el is ImageElement => selectedIds.includes(el.id) && el.type === 'image'); if (elementsToMerge.length < 2) return; setGlobalIsLoading(true); dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: selectedIds.map(id => ({ id, changes: { isLoading: true } })) }}); try { const imageUrls = elementsToMerge.map(el => el.src); const newImageSrc = await geminiService.mergeImages(imageUrls, prompt); const img = new Image(); img.onload = () => { const nextZIndex = state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1; const newEl: ImageElement = { id: crypto.randomUUID(), type: 'image', parentId: null, src: newImageSrc, x: elementsToMerge[0].x, y: elementsToMerge[0].y, width: img.width > 768 ? 768 : img.width, height: img.height > 768 ? (768 * img.height/img.width) : img.height, rotation: 0, zIndex: nextZIndex }; dispatch({ type: 'DELETE_SELECTED_ELEMENTS' }); dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newEl] }}); }; img.src = newImageSrc; } catch (error) { console.error("Image merge failed:", error); alert("Sorry, image merge failed. Please try again."); dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: selectedIds.map(id => ({ id, changes: { isLoading: false } })) }}); } finally { setGlobalIsLoading(false); } };
  
  const rasterizeElement = async (element: CanvasElement, allElements: CanvasElement[]): Promise<string> => {
    if (element.type === 'image') return element.src;

    if (element.type === 'frame') {
        const frameCanvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        frameCanvas.width = element.width * dpr;
        frameCanvas.height = element.height * dpr;
        const ctx = frameCanvas.getContext('2d')!;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = element.backgroundColor;
        ctx.fillRect(0, 0, element.width, element.height);

        const children = allElements.filter(el => el.parentId === element.id).sort((a,b) => a.zIndex - b.zIndex);

        for (const child of children) {
            const childImageSrc = await rasterizeElement(child, allElements);
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = (e) => reject(new Error(`Failed to load image for rasterization: ${childImageSrc.substring(0,100)}...`));
                img.src = childImageSrc;
            });
            ctx.drawImage(img, child.x - element.x, child.y - element.y, child.width, child.height);
        }
        return frameCanvas.toDataURL('image/png');
    }

    let svgContent = '';
    const strokeWidth = 'strokeWidth' in element ? element.strokeWidth : 0;
    const strokeColor = 'strokeColor' in element ? element.strokeColor : 'none';
    const fillColor = 'fillColor' in element ? element.fillColor : ('color' in element ? element.color : 'none');
    
    switch (element.type) {
        case 'shape':
            const { shapeType, flipHorizontal, flipVertical } = element;
            const svgProps = `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"`;
            const lineX1 = flipHorizontal ? element.width : 0; const lineY1 = flipVertical ? element.height : 0;
            const lineX2 = flipHorizontal ? 0 : element.width; const lineY2 = flipVertical ? 0 : element.height;
            if (shapeType === 'rectangle') svgContent = `<rect x="0" y="0" width="${element.width}" height="${element.height}" ${svgProps} />`;
            if (shapeType === 'ellipse') svgContent = `<ellipse cx="${element.width / 2}" cy="${element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" ${svgProps} />`;
            if (shapeType === 'line') svgContent = `<line x1="${lineX1}" y1="${lineY1}" x2="${lineX2}" y2="${lineY2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
            if (shapeType === 'arrow') svgContent = `<defs><marker id="arrowhead-${element.id}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${strokeColor}" /></marker></defs><line x1="${lineX1}" y1="${lineY1}" x2="${lineX2}" y2="${lineY2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" marker-end="url(#arrowhead-${element.id})" />`;
            if (shapeType === 'polygon') svgContent = `<polygon points="${getPolygonPoints(element.width/2, element.height/2, Math.min(element.width, element.height)/2, 6).map(p => `${p.x},${p.y}`).join(' ')}" ${svgProps} />`;
            if (shapeType === 'star') svgContent = `<polygon points="${getStarPoints(element.width/2, element.height/2, Math.min(element.width, element.height)/2, Math.min(element.width, element.height)/4, 5).map(p => `${p.x},${p.y}`).join(' ')}" ${svgProps} />`;
            break;
        case 'drawing':
            svgContent = `<path d="${element.d}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
            break;
        case 'text':
             svgContent = `<text x="0" y="${element.fontSize}" font-family="${element.fontFamily}" font-size="${element.fontSize}" fill="${fillColor}">${element.content}</text>`;
            break;
    }

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${element.width + strokeWidth}" height="${element.height + strokeWidth}" viewBox="${-strokeWidth/2} ${-strokeWidth/2} ${element.width + strokeWidth} ${element.height + strokeWidth}">${svgContent}</svg>`;
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const safeWidth = Math.max(1, element.width + strokeWidth);
            const safeHeight = Math.max(1, element.height + strokeWidth);
            canvas.width = safeWidth;
            canvas.height = safeHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error("Could not create canvas context")); return; }
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load SVG as image")); };
        img.src = url;
    });
};

  const handleAiEditSubmit = async (prompt: string) => {
      const { elementToEdit } = aiEditModal;
      if (!elementToEdit) return;
      
      const elementId = elementToEdit.id;
      setAiEditModal({ isOpen: false, elementToEdit: null });
      setGlobalIsLoading(true);
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: elementId, changes: { isLoading: true }}] } });

      try {
        const imageSrc = await rasterizeElement(elementToEdit, state.elements);
        const newImageSrc = await geminiService.editImageGlobally(imageSrc, prompt);
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const originalElement = state.elements.find(el => el.id === elementId)!;
            const newImageElement: ImageElement = { 
                ...originalElement, 
                type: 'image', 
                id: crypto.randomUUID(), 
                src: newImageSrc, 
                width: img.width, 
                height: img.height, 
                isLoading: false 
            };
            const originalIndex = state.elements.findIndex(el => el.id === elementId);
            if (originalIndex !== -1) {
              const elementsCopy = [...state.elements];
              // Replace old element, preserving children if it was a frame
              const newElements = elementsCopy.filter(el => el.id !== elementId);
              newElements.splice(originalIndex, 0, newImageElement);
              dispatch({ type: 'REORDER_LAYERS', payload: { reorderedElements: newElements } });
              dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [newImageElement.id], shiftKey: false }})
            }
        }
        img.src = newImageSrc;

      } catch (error) {
        console.error("AI edit failed:", error); alert(`Sorry, the AI edit failed. ${error}`);
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: elementId, changes: { isLoading: false }}] }});
      } finally {
        setGlobalIsLoading(false);
      }
  };

  const handleWheel = useCallback((e: WheelEvent) => { e.preventDefault(); setContextMenu(null); const zoomFactor = 1 - e.deltaY * 0.001; const newZoom = Math.max(0.1, Math.min(view.zoom * zoomFactor, 10)); const mousePos = { x: e.clientX, y: e.clientY }; const worldPosBeforeZoom = screenToWorld(mousePos); const newPan = { x: mousePos.x - worldPosBeforeZoom.x * newZoom, y: mousePos.y - worldPosBeforeZoom.y * newZoom, }; setView({ zoom: newZoom, pan: newPan }); }, [view, screenToWorld]);
  const handleBringToFront = useCallback(() => dispatch({ type: 'BRING_TO_FRONT' }), [dispatch]);
  const handleSendToBack = useCallback(() => dispatch({ type: 'SEND_TO_BACK' }), [dispatch]);
  const handleDuplicate = useCallback(() => dispatch({ type: 'DUPLICATE_SELECTED_ELEMENTS' }), [dispatch]);
  const handleDelete = useCallback(() => { dispatch({ type: 'DELETE_SELECTED_ELEMENTS' }); interactionRef.current = null; }, [dispatch]);
  const handleSelectAll = useCallback(() => dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: state.elements.map(el => el.id), shiftKey: false } }), [dispatch, state.elements]);
  const handleContextMenu = useCallback((e: MouseEvent) => { e.preventDefault(); const targetIsCanvas = e.target === e.currentTarget; if(targetIsCanvas) { const items: ContextMenuItem[] = [ { label: 'Select All', action: handleSelectAll, icon: <BoxSelect size={16} /> }, ]; setContextMenu({ x: e.clientX, y: e.clientY, items }); } }, [handleSelectAll]);
  
  const handleAiEditText = async () => {
      const selectedElements = state.elements.filter(el => state.selectedElementIds.includes(el.id));
      const imageEl = selectedElements.find((el): el is ImageElement => el.type === 'image');
      const textEl = selectedElements.find((el): el is TextElement => el.type === 'text');
      if (!imageEl || !textEl) return;
      
      setGlobalIsLoading(true);
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: imageEl.id, changes: { isLoading: true }}]}});
      try {
          const newImageSrc = await geminiService.editImageWithTextPrompt(imageEl.src, textEl.content);
          dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: imageEl.id, changes: { src: newImageSrc, isLoading: false } }] } });
      } catch(e) {
        console.error("AI text edit failed", e); alert("Sorry, the AI edit failed. Please try again.");
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: imageEl.id, changes: { isLoading: false }}]}});
      } finally {
        setGlobalIsLoading(false);
      }
  };

  const handleElementContextMenu = useCallback((e: MouseEvent, elementId: string) => {
      e.preventDefault();
      const currentElement = state.elements.find(el => el.id === elementId);
      if (!currentElement) return;
      
      if (!state.selectedElementIds.includes(elementId)) {
        dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [elementId], shiftKey: false } });
      }
      
      const selectedElements = state.elements.filter(el => state.selectedElementIds.includes(el.id));
      const hasImageAndText = selectedElements.some(el => el.type === 'image') && selectedElements.some(el => el.type === 'text');

      const items: ContextMenuItem[] = [
        { label: 'Edit Image with Text', action: handleAiEditText, icon: <MessageSquareText size={16}/>, disabled: !hasImageAndText },
        { label: 'Edit with AI', action: () => setAiEditModal({ isOpen: true, elementToEdit: currentElement }), icon: <Wand2 size={16}/> },
        ...(currentElement.type === 'image' ? [{ label: 'Expand Image', action: () => setExpandingElementId(currentElement.id), icon: <Maximize size={16}/> }] : []),
        { label: 'Bring to Front', action: handleBringToFront, icon: <BringToFront size={16}/> },
        { label: 'Send to Back', action: handleSendToBack, icon: <SendToBack size={16}/> },
        { label: 'Duplicate', action: handleDuplicate, icon: <Copy size={16} /> },
        { label: 'Delete', action: handleDelete, icon: <Trash2 size={16} /> },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [state.selectedElementIds, state.elements, dispatch, handleBringToFront, handleSendToBack, handleDuplicate, handleDelete, handleAiEditText]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return;
      if (e.key === ' ' && !e.repeat) { setIsSpacePressed(true); }
      if (e.key === 'Escape') { 
        if(interactionRef.current?.type === 'pen') { interactionRef.current = null; }
        setActiveTool(Tool.Select);
        if (expandingElementId) setExpandingElementId(null);
        if (editingElementId) setEditingElementId(null);
      }
      if(e.key === 'Backspace') { handleDelete(); } 
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    const handleKeyUp = (e: globalThis.KeyboardEvent) => { if (e.key === ' ') { setIsSpacePressed(false); } };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }
  }, [handleDelete, undo, activeTool, expandingElementId, editingElementId, setActiveTool]);
  
  useEffect(() => { if(uploadTrigger > 0) fileInputRef.current?.click(); }, [uploadTrigger]);
  useEffect(() => { 
    if (activeTool !== Tool.Brush) { 
        if (brushState && document.body.contains(brushState.maskCanvas)) {
            document.body.removeChild(brushState.maskCanvas); 
        }
        setBrushState(null); 
    }
    if (activeTool !== Tool.Select) {
      setExpandingElementId(null);
      setEditingElementId(null);
    }
  }, [activeTool, brushState]);

  const topLevelElements = state.elements.filter(el => el.parentId === null).sort((a,b) => a.zIndex - b.zIndex);
  const elementBeingCreatedId = (interactionRef.current?.type === 'draw' || interactionRef.current?.type === 'pen') ? interactionRef.current.elementId : null;
  const showGenerateBar = activeTool === Tool.Generate;
  const showMergeBar = activeTool === Tool.Merge && state.selectedElementIds.filter(id => state.elements.find(el => el.id === id)?.type === 'image').length > 1;
  const showBrushBar = activeTool === Tool.Brush && brushState !== null;
  const isDrawingInFrameOnlyArea = FRAME_ONLY_TOOLS.includes(activeTool) && !isOverFrameForDrawing;
  const cursorStyle = isSpacePressed || activeTool === Tool.Hand ? 'grab' : isDrawingInFrameOnlyArea ? 'not-allowed' : CURSOR_MAP[activeTool] || 'default';

  return (
    <div className="w-full h-full relative overflow-hidden" ref={canvasRef}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
      onWheel={handleWheel} onContextMenu={handleContextMenu}
      style={{ cursor: cursorStyle }}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
      <div style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
        {topLevelElements.map(element => (
            <ElementRenderer
              key={element.id}
              element={element}
              allElements={state.elements}
              selectedElementIds={state.selectedElementIds}
              editingElementId={editingElementId}
              elementBeingCreatedId={elementBeingCreatedId}
              expandingElementId={expandingElementId}
              onMouseDown={handleElementMouseDown}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleElementContextMenu}
              onBrushStart={handleBrushStart}
              onResizeStart={onResizeStart}
              onExpandStart={onExpandStart}
              onUpdateText={handleUpdateText}
              activeTool={activeTool}
              viewZoom={view.zoom}
            />
          ))}
      </div>
      <button onClick={(e) => { e.preventDefault(); undo(); }} disabled={!canUndo} className="absolute top-6 left-24 z-20 p-3 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all" title="Undo (Ctrl+Z)"><Undo size={20} /></button>
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      
      {showGenerateBar && <AIPromptBar onSubmit={handleAIGenerate} placeholder="A futuristic cityscape at sunset..." buttonText="Generate" isLoading={globalIsLoading} />}
      {showMergeBar && <AIPromptBar onSubmit={handleAIMerge} placeholder="Merge images into a surreal collage..." buttonText="Merge" isLoading={globalIsLoading} />}
      {showBrushBar && <AIPromptBar onSubmit={handleBrushSubmit} placeholder="Describe the edit for the selected area..." buttonText="Apply Edit" isLoading={globalIsLoading} />}
      <PromptModal isOpen={aiEditModal.isOpen} onClose={() => setAiEditModal({isOpen: false, elementToEdit: null})} onSubmit={handleAiEditSubmit} isLoading={globalIsLoading} />
    </div>
  );
};

export default Canvas;