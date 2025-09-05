import React, { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react';
import { Undo, Wand2, Camera, Maximize } from 'lucide-react';
import { Tool, CanvasElement, ImageElement, Point, ContextMenuItem, CanvasState, CanvasAction, FrameElement, TextElement, ShapeElement, DrawingElement } from '../types';
import { CURSOR_MAP } from '../constants';
import * as geminiService from '../services/geminiService';
import AIPromptBar from './AIPromptBar';
import ContextMenu from './ContextMenu';
import PromptModal from './PromptModal';
import AutoStyleModal from './AutoStyleModal';
import { BringToFront, SendToBack, Copy, Trash2 } from 'lucide-react';

type BrushState = {
  element: ImageElement;
  maskCanvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  screenPointsStrokes: Point[][];
} | null;

type AiEditPromptBarState = {
    isOpen: boolean;
    elementToEdit: CanvasElement | null;
}

type AutoStyleModalState = {
    isOpen: boolean;
    elementToStyle: CanvasElement | null;
}

type ViewState = { pan: Point; zoom: number };

type Interaction = 
  | { type: 'pan', startX: number, startY: number }
  | { type: 'brushing' }
  | { type: 'move', startViewX: number, startViewY: number, originalElements: CanvasElement[] }
  | { type: 'resize', handle: string, startX: number, startY: number, originalElement: CanvasElement }
  | { type: 'expand', handle: string, startX: number, startY: number, originalElement: ImageElement }
  | { type: 'draw', elementType: 'frame' | 'shape' | 'text' | 'drawing', shapeType?: ShapeElement['shapeType'], startX: number, startY: number, elementId: string, parentId: string | null, drawMode: 'corner' | 'center' | 'line', points?: Point[] }
  | { type: 'pen', points: Point[], elementId: string, parentId: string | null }
  | null;

const isPointInElement = (point: Point, element: CanvasElement) => {
    return (
      point.x >= element.x &&
      point.x <= element.x + element.width &&
      point.y >= element.y &&
      point.y <= element.y + element.height
    );
};

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

const HtmlCanvas: React.FC<CanvasProps> = ({ activeTool, uploadTrigger, setActiveTool, color, state, dispatch, undo, canUndo }) => {
  const [view, setView] = useState<ViewState>({ pan: { x: 0, y: 0 }, zoom: 1 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const htmlCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const interactionRef = useRef<Interaction>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [brushState, setBrushState] = useState<BrushState>(null);
  const [globalIsLoading, setGlobalIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [aiEditPromptBar, setAiEditPromptBar] = useState<AiEditPromptBarState>({ isOpen: false, elementToEdit: null });
  const [autoStyleModal, setAutoStyleModal] = useState<AutoStyleModalState>({ isOpen: false, elementToStyle: null });
  const [expandingElementId, setExpandingElementId] = useState<string | null>(null);
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);

  const screenToWorld = useCallback((screenPoint: Point): Point => {
    return {
      x: (screenPoint.x - view.pan.x) / view.zoom,
      y: (screenPoint.y - view.pan.y) / view.zoom,
    };
  }, [view]);

  const worldToScreen = useCallback((worldPoint: Point): Point => {
    return {
      x: worldPoint.x * view.zoom + view.pan.x,
      y: worldPoint.y * view.zoom + view.pan.y,
    };
  }, [view]);

  // Load image and cache it
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    if (imageCacheRef.current.has(src)) {
      return Promise.resolve(imageCacheRef.current.get(src)!);
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageCacheRef.current.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  // Redraw the canvas
  const redrawCanvas = useCallback(() => {
    const canvas = htmlCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid background
    ctx.save();
    ctx.translate(view.pan.x, view.pan.y);
    ctx.scale(view.zoom, view.zoom);
    
    // Draw grid
    const gridSize = 20;
    const minX = -view.pan.x / view.zoom;
    const minY = -view.pan.y / view.zoom;
    const maxX = (canvas.width - view.pan.x) / view.zoom;
    const maxY = (canvas.height - view.pan.y) / view.zoom;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / view.zoom;
    
    // Vertical lines
    for (let x = Math.floor(minX / gridSize) * gridSize; x <= maxX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = Math.floor(minY / gridSize) * gridSize; y <= maxY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Draw all elements (sorted by zIndex)
    const sortedElements = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedElements.forEach(element => {
      switch (element.type) {
        case 'frame':
          ctx.save();
          ctx.translate(view.pan.x, view.pan.y);
          ctx.scale(view.zoom, view.zoom);
          
          // Draw frame background
          ctx.fillStyle = element.backgroundColor;
          ctx.fillRect(element.x, element.y, element.width, element.height);
          
          // Draw frame border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1 / view.zoom;
          ctx.strokeRect(element.x, element.y, element.width, element.height);
          
          // Draw selection outline if selected
          if (state.selectedElementIds.includes(element.id)) {
            ctx.strokeStyle = '#6D35FF';
            ctx.lineWidth = 2 / view.zoom;
            ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
            ctx.strokeRect(element.x, element.y, element.width, element.height);
            ctx.setLineDash([]);
          }
          
          ctx.restore();
          break;
          
        case 'image':
          loadImage(element.src).then(img => {
            ctx.save();
            ctx.translate(view.pan.x, view.pan.y);
            ctx.scale(view.zoom, view.zoom);
            
            // Draw image
            ctx.translate(element.x, element.y);
            ctx.rotate(element.rotation * Math.PI / 180);
            ctx.drawImage(img, 0, 0, element.width, element.height);
            
            ctx.restore();
            
            // If this is the expanding element, draw expansion handles
            if (expandingElementId === element.id) {
              ctx.save();
              ctx.translate(view.pan.x, view.pan.y);
              ctx.scale(view.zoom, view.zoom);
              
              ctx.strokeStyle = '#6D35FF';
              ctx.lineWidth = 2 / view.zoom;
              ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
              
              // Draw expansion handles
              const handleSize = 8 / view.zoom;
              const handles = [
                { x: element.x - handleSize/2, y: element.y - handleSize/2 }, // top-left
                { x: element.x + element.width/2 - handleSize/2, y: element.y - handleSize/2 }, // top-center
                { x: element.x + element.width - handleSize/2, y: element.y - handleSize/2 }, // top-right
                { x: element.x + element.width - handleSize/2, y: element.y + element.height/2 - handleSize/2 }, // right-center
                { x: element.x + element.width - handleSize/2, y: element.y + element.height - handleSize/2 }, // bottom-right
                { x: element.x + element.width/2 - handleSize/2, y: element.y + element.height - handleSize/2 }, // bottom-center
                { x: element.x - handleSize/2, y: element.y + element.height - handleSize/2 }, // bottom-left
                { x: element.x - handleSize/2, y: element.y + element.height/2 - handleSize/2 }, // left-center
              ];
              
              handles.forEach(handle => {
                ctx.fillStyle = '#6D35FF';
                ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
                ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
              });
              
              ctx.restore();
            }
          }).catch(err => {
            console.error("Failed to load image:", err);
          });
          break;
          
        case 'text':
          ctx.save();
          ctx.translate(view.pan.x, view.pan.y);
          ctx.scale(view.zoom, view.zoom);
          
          // Draw text
          ctx.font = `${element.fontSize}px ${element.fontFamily}`;
          ctx.fillStyle = element.color;
          ctx.fillText(element.content, element.x, element.y + element.fontSize);
          
          // Draw selection outline if selected
          if (state.selectedElementIds.includes(element.id) && editingTextElementId !== element.id) {
            const textWidth = ctx.measureText(element.content).width;
            const textHeight = element.fontSize;
            
            ctx.strokeStyle = '#6D35FF';
            ctx.lineWidth = 2 / view.zoom;
            ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
            ctx.strokeRect(element.x, element.y, textWidth, textHeight);
            ctx.setLineDash([]);
          }
          
          ctx.restore();
          break;
          
        case 'shape':
          ctx.save();
          ctx.translate(view.pan.x, view.pan.y);
          ctx.scale(view.zoom, view.zoom);
          
          const { shapeType, strokeColor, strokeWidth, fillColor, flipHorizontal, flipVertical } = element;
          const halfStroke = strokeWidth / 2;
          
          ctx.translate(element.x, element.y);
          ctx.rotate(element.rotation * Math.PI / 180);
          
          switch (shapeType) {
            case 'rectangle':
              ctx.fillStyle = fillColor;
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              ctx.fillRect(0, 0, element.width, element.height);
              ctx.strokeRect(0, 0, element.width, element.height);
              break;
              
            case 'ellipse':
              ctx.fillStyle = fillColor;
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              ctx.beginPath();
              ctx.ellipse(element.width/2, element.height/2, element.width/2, element.height/2, 0, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              break;
              
            case 'line':
              const lineX1 = flipHorizontal ? element.width : 0;
              const lineY1 = flipVertical ? element.height : 0;
              const lineX2 = flipHorizontal ? 0 : element.width;
              const lineY2 = flipVertical ? 0 : element.height;
              
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              ctx.beginPath();
              ctx.moveTo(lineX1, lineY1);
              ctx.lineTo(lineX2, lineY2);
              ctx.stroke();
              break;
              
            case 'arrow':
              const arrowX1 = flipHorizontal ? element.width : 0;
              const arrowY1 = flipVertical ? element.height : 0;
              const arrowX2 = flipHorizontal ? 0 : element.width;
              const arrowY2 = flipVertical ? 0 : element.height;
              
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              ctx.beginPath();
              ctx.moveTo(arrowX1, arrowY1);
              ctx.lineTo(arrowX2, arrowY2);
              ctx.stroke();
              
              // Draw arrowhead
              const angle = Math.atan2(arrowY2 - arrowY1, arrowX2 - arrowX1);
              const headLength = 10;
              
              ctx.beginPath();
              ctx.moveTo(arrowX2, arrowY2);
              ctx.lineTo(arrowX2 - headLength * Math.cos(angle - Math.PI/6), arrowY2 - headLength * Math.sin(angle - Math.PI/6));
              ctx.moveTo(arrowX2, arrowY2);
              ctx.lineTo(arrowX2 - headLength * Math.cos(angle + Math.PI/6), arrowY2 - headLength * Math.sin(angle + Math.PI/6));
              ctx.stroke();
              break;
              
            case 'polygon':
              ctx.fillStyle = fillColor;
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              ctx.beginPath();
              const polygonPoints = getPolygonPoints(element.width/2, element.height/2, Math.min(element.width, element.height)/2, 6);
              ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
              for (let i = 1; i < polygonPoints.length; i++) {
                ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              break;
              
            case 'star':
              ctx.fillStyle = fillColor;
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              ctx.beginPath();
              const starPoints = getStarPoints(element.width/2, element.height/2, Math.min(element.width, element.height)/2, Math.min(element.width, element.height)/4, 5);
              ctx.moveTo(starPoints[0].x, starPoints[0].y);
              for (let i = 1; i < starPoints.length; i++) {
                ctx.lineTo(starPoints[i].x, starPoints[i].y);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              break;
          }
          
          // Draw selection outline if selected
          if (state.selectedElementIds.includes(element.id)) {
            ctx.strokeStyle = '#6D35FF';
            ctx.lineWidth = 2 / view.zoom;
            ctx.setLineDash([5 / view.zoom, 5 / view.zoom]);
            ctx.strokeRect(-halfStroke, -halfStroke, element.width + strokeWidth, element.height + strokeWidth);
            ctx.setLineDash([]);
          }
          
          ctx.restore();
          break;
          
        case 'drawing':
          ctx.save();
          ctx.translate(view.pan.x, view.pan.y);
          ctx.scale(view.zoom, view.zoom);
          
          // Draw SVG path
          const path = new Path2D(element.d);
          ctx.strokeStyle = element.strokeColor;
          ctx.lineWidth = element.strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke(path);
          
          ctx.restore();
          break;
      }
    });
    
    // Draw brush strokes if active
    if (brushState && brushState.element) {
      brushState.screenPointsStrokes.forEach(stroke => {
        if (stroke.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.strokeStyle = 'rgba(128, 0, 128, 0.25)';
        ctx.lineWidth = 40;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      });
    }
    
    // Draw current drawing if in drawing mode
    const currentInteraction = interactionRef.current;
    if (currentInteraction && (currentInteraction.type === 'draw' || currentInteraction.type === 'pen')) {
      if (currentInteraction.type === 'draw' && currentInteraction.points && currentInteraction.points.length > 1) {
        ctx.beginPath();
        const firstPoint = currentInteraction.points[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < currentInteraction.points.length; i++) {
          const point = currentInteraction.points[i];
          ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (currentInteraction.type === 'pen' && currentInteraction.points && currentInteraction.points.length > 1) {
        ctx.beginPath();
        const firstPoint = currentInteraction.points[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < currentInteraction.points.length; i++) {
          const point = currentInteraction.points[i];
          ctx.lineTo(point.x, point.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
  }, [state.elements, state.selectedElementIds, brushState, loadImage, expandingElementId, view, color, editingTextElementId]);

  // Initialize canvas
  useEffect(() => {
    const canvas = htmlCanvasRef.current;
    if (!canvas) return;
    
    // Set canvas size to match container
    const resizeCanvas = () => {
      if (canvasRef.current) {
        canvas.width = canvasRef.current.clientWidth;
        canvas.height = canvasRef.current.clientHeight;
        redrawCanvas();
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [redrawCanvas]);

  // Redraw when state changes
  useEffect(() => {
    redrawCanvas();
  }, [state, redrawCanvas]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(screenPos);
    setContextMenu(null);

    if (e.button !== 0 || interactionRef.current) return;
    
    if (isSpacePressed || activeTool === Tool.Hand) {
      interactionRef.current = { type: 'pan', startX: screenPos.x - view.pan.x, startY: screenPos.y - view.pan.y };
      return;
    }
    
    // Handle brush tool
    if (activeTool === Tool.Brush) {
      const targetElement = state.elements.find(el => 
        el.type === 'image' && isPointInElement(worldPos, el)
      ) as ImageElement | undefined;
      
      if (targetElement) {
        interactionRef.current = { type: 'brushing' };
        const screenPos = { x: e.clientX, y: e.clientY };
        let currentBrushState = brushState;
        
        if (!currentBrushState || currentBrushState.element.id !== targetElement.id) {
            if (currentBrushState && document.body.contains(currentBrushState.maskCanvas)) {
              document.body.removeChild(currentBrushState.maskCanvas);
            }
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = window.innerWidth; 
            maskCanvas.height = window.innerHeight;
            Object.assign(maskCanvas.style, { 
              position: 'fixed', 
              top: '0', 
              left: '0', 
              pointerEvents: 'none', 
              zIndex: '10000', 
              cursor: 'crosshair' 
            });
            document.body.appendChild(maskCanvas);
            const ctx = maskCanvas.getContext('2d')!;
            Object.assign(ctx, { 
              strokeStyle: 'rgba(128, 0, 128, 0.25)', 
              lineWidth: 40, 
              lineCap: 'round', 
              lineJoin: 'round' 
            });
            currentBrushState = { element: targetElement, maskCanvas, ctx, screenPointsStrokes: [] };
        }
        
        const { ctx, screenPointsStrokes } = currentBrushState;
        screenPointsStrokes.push([screenPos]);
        ctx.beginPath();
        ctx.moveTo(screenPos.x, screenPos.y);
        setBrushState(currentBrushState);
        return;
      }
    }
    
    // Handle expand tool
    if (expandingElementId) {
      const expandingElement = state.elements.find(el => el.id === expandingElementId) as ImageElement | undefined;
      if (expandingElement && isPointInElement(worldPos, expandingElement)) {
        // Check if click is on an expansion handle
        const handleSize = 8 / view.zoom;
        const handles = [
          { x: expandingElement.x - handleSize/2, y: expandingElement.y - handleSize/2, handle: 'top-left' },
          { x: expandingElement.x + expandingElement.width/2 - handleSize/2, y: expandingElement.y - handleSize/2, handle: 'top-center' },
          { x: expandingElement.x + expandingElement.width - handleSize/2, y: expandingElement.y - handleSize/2, handle: 'top-right' },
          { x: expandingElement.x + expandingElement.width - handleSize/2, y: expandingElement.y + expandingElement.height/2 - handleSize/2, handle: 'right-center' },
          { x: expandingElement.x + expandingElement.width - handleSize/2, y: expandingElement.y + expandingElement.height - handleSize/2, handle: 'bottom-right' },
          { x: expandingElement.x + expandingElement.width/2 - handleSize/2, y: expandingElement.y + expandingElement.height - handleSize/2, handle: 'bottom-center' },
          { x: expandingElement.x - handleSize/2, y: expandingElement.y + expandingElement.height - handleSize/2, handle: 'bottom-left' },
          { x: expandingElement.x - handleSize/2, y: expandingElement.y + expandingElement.height/2 - handleSize/2, handle: 'left-center' },
        ];
        
        for (const handle of handles) {
          if (
            screenPos.x >= handle.x && 
            screenPos.x <= handle.x + handleSize && 
            screenPos.y >= handle.y && 
            screenPos.y <= handle.y + handleSize
          ) {
            interactionRef.current = { 
              type: 'expand', 
              handle: handle.handle, 
              startX: screenPos.x, 
              startY: screenPos.y, 
              originalElement: expandingElement 
            };
            return;
          }
        }
      }
    }
    
    // Handle drawing tools
    const drawingTools = [Tool.Frame, Tool.Rectangle, Tool.Ellipse, Tool.Line, Tool.Arrow, Tool.Polygon, Tool.Star, Tool.Pen, Tool.Text];
    if (drawingTools.includes(activeTool)) {
      // Check if we're clicking inside a frame for tools that require a frame
      const frameTools = []; // Pen and Text should work outside frames
      const clickedFrame = state.elements.find(el => el.type === 'frame' && isPointInElement(worldPos, el)) as FrameElement | undefined;
      
      if (frameTools.includes(activeTool) && !clickedFrame) {
        // These tools require a frame
        return;
      }
      
      const parentId = clickedFrame ? clickedFrame.id : null;
      
      // Create new element based on tool
      let newElement: CanvasElement;
      const elementId = crypto.randomUUID();
      
      switch (activeTool) {
        case Tool.Frame:
          newElement = {
            id: elementId,
            type: 'frame',
            parentId: null,
            x: worldPos.x,
            y: worldPos.y,
            width: 0,
            height: 0,
            rotation: 0,
            zIndex: state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1,
            backgroundColor: 'rgba(0, 0, 0, 0.1)'
          } as FrameElement;
          break;
          
        case Tool.Text:
          newElement = {
            id: elementId,
            type: 'text',
            parentId,
            x: worldPos.x,
            y: worldPos.y,
            width: 100,
            height: 30,
            rotation: 0,
            zIndex: state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1,
            content: 'Text',
            fontSize: 20,
            color: color,
            fontFamily: 'Arial'
          } as TextElement;
          break;
          
        case Tool.Pen:
          interactionRef.current = {
            type: 'pen',
            points: [worldPos],
            elementId,
            parentId
          };
          return;
          
        default:
          // Shape tools
          let shapeType: ShapeElement['shapeType'] = 'rectangle';
          switch (activeTool) {
            case Tool.Rectangle: shapeType = 'rectangle'; break;
            case Tool.Ellipse: shapeType = 'ellipse'; break;
            case Tool.Line: shapeType = 'line'; break;
            case Tool.Arrow: shapeType = 'arrow'; break;
            case Tool.Polygon: shapeType = 'polygon'; break;
            case Tool.Star: shapeType = 'star'; break;
          }
          
          newElement = {
            id: elementId,
            type: 'shape',
            parentId,
            x: worldPos.x,
            y: worldPos.y,
            width: 0,
            height: 0,
            rotation: 0,
            zIndex: state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1,
            shapeType,
            strokeColor: color,
            strokeWidth: 2,
            fillColor: 'transparent',
            flipHorizontal: false,
            flipVertical: false
          } as ShapeElement;
      }
      
      // For frame and shape tools, start drawing interaction
      if (activeTool === Tool.Frame || 
          [Tool.Rectangle, Tool.Ellipse, Tool.Line, Tool.Arrow, Tool.Polygon, Tool.Star].includes(activeTool)) {
        interactionRef.current = {
          type: 'draw',
          elementType: activeTool === Tool.Frame ? 'frame' : 'shape',
          shapeType: activeTool !== Tool.Frame ? (newElement as ShapeElement).shapeType : undefined,
          startX: worldPos.x,
          startY: worldPos.y,
          elementId,
          parentId,
          drawMode: 'corner'
        };
        return;
      }
      
      // For text tool, add element immediately and start editing
      if (activeTool === Tool.Text) {
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
        setEditingTextElementId(elementId);
        redrawCanvas();
        return;
      }
      
      return;
    }
    
    // Handle element selection
    // Find elements in reverse order (topmost first)
    const sortedElements = [...state.elements].sort((a, b) => b.zIndex - a.zIndex);
    const clickedElement = sortedElements.find(el => isPointInElement(worldPos, el));
    
    if (clickedElement) {
      if (!state.selectedElementIds.includes(clickedElement.id)) {
        dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [clickedElement.id], shiftKey: e.shiftKey } });
      }
      
      // Start moving interaction
      const newSelectedIds = e.shiftKey ? 
        (state.selectedElementIds.includes(clickedElement.id) ? 
          state.selectedElementIds.filter(sid => sid !== clickedElement.id) : 
          [...state.selectedElementIds, clickedElement.id]) : 
        [clickedElement.id];
        
      const elementsToMove = state.elements.filter(el => newSelectedIds.includes(el.id));
      interactionRef.current = { 
        type: 'move', 
        startViewX: worldPos.x, 
        startViewY: worldPos.y, 
        originalElements: elementsToMove 
      };
    } else {
      // Clicked on empty space, clear selection
      dispatch({ type: 'CLEAR_SELECTION' });
      setEditingTextElementId(null);
    }
  }, [activeTool, dispatch, isSpacePressed, view, screenToWorld, state.elements, state.selectedElementIds, brushState, expandingElementId, color]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const screenPos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(screenPos);
    
    const currentInteraction = interactionRef.current;
    if (!currentInteraction) return;

    if (currentInteraction.type === 'brushing' && brushState) {
        const { ctx, screenPointsStrokes } = brushState;
        const currentStroke = screenPointsStrokes[screenPointsStrokes.length - 1];
        currentStroke.push(screenPos);
        ctx.lineTo(screenPos.x, screenPos.y);
        ctx.stroke();
        redrawCanvas();
        return;
    }
    
    if (currentInteraction.type === 'pan') {
      setView(v => ({ ...v, pan: { x: screenPos.x - currentInteraction.startX, y: screenPos.y - currentInteraction.startY } }));
      redrawCanvas();
      return;
    }

    if (currentInteraction.type === 'move') {
      const { startViewX, startViewY, originalElements } = currentInteraction;
      const dx = worldPos.x - startViewX;
      const dy = worldPos.y - startViewY;
      const updates = originalElements.map(el => ({ id: el.id, changes: { x: el.x + dx, y: el.y + dy } }));
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates, overwriteHistory: true }});
      redrawCanvas();
      return;
    }
    
    if (currentInteraction.type === 'expand' && expandingElementId) {
      // Visual feedback for expansion
      redrawCanvas();
      return;
    }
    
    if (currentInteraction.type === 'draw') {
      // Update element size as we drag
      const { startX, startY } = currentInteraction;
      const width = Math.abs(worldPos.x - startX);
      const height = Math.abs(worldPos.y - startY);
      const x = Math.min(worldPos.x, startX);
      const y = Math.min(worldPos.y, startY);
      
      // Update the element being drawn
      redrawCanvas();
      return;
    }
    
    if (currentInteraction.type === 'pen') {
      // Add point to pen drawing
      currentInteraction.points.push(worldPos);
      redrawCanvas();
      return;
    }
  }, [dispatch, brushState, screenToWorld, redrawCanvas, expandingElementId]);

  const handleMouseUp = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const currentInteraction = interactionRef.current;
    if (!currentInteraction) return;

    if (currentInteraction.type === 'brushing' && brushState) {
      // Brushing finished, show prompt bar
      interactionRef.current = null;
      setAiEditPromptBar({ isOpen: true, elementToEdit: brushState.element });
      return;
    }
    
    if (currentInteraction.type === 'expand' && expandingElementId) {
      const { handle, startX, startY, originalElement } = currentInteraction;
      const screenPos = { x: e.clientX, y: e.clientY };
      const dx = (screenPos.x - startX) / view.zoom;
      const dy = (screenPos.y - startY) / view.zoom;
      
      // Calculate new dimensions based on handle
      let newWidth = originalElement.width;
      let newHeight = originalElement.height;
      let newX = originalElement.x;
      let newY = originalElement.y;
      
      switch (handle) {
        case 'right-center':
          newWidth = Math.max(50, originalElement.width + dx);
          break;
        case 'bottom-center':
          newHeight = Math.max(50, originalElement.height + dy);
          break;
        case 'bottom-right':
          newWidth = Math.max(50, originalElement.width + dx);
          newHeight = Math.max(50, originalElement.height + dy);
          break;
        case 'top-left':
          newWidth = Math.max(50, originalElement.width - dx);
          newHeight = Math.max(50, originalElement.height - dy);
          newX = originalElement.x + dx;
          newY = originalElement.y + dy;
          break;
        case 'top-right':
          newWidth = Math.max(50, originalElement.width + dx);
          newHeight = Math.max(50, originalElement.height - dy);
          newY = originalElement.y + dy;
          break;
        case 'bottom-left':
          newWidth = Math.max(50, originalElement.width - dx);
          newHeight = Math.max(50, originalElement.height + dy);
          newX = originalElement.x + dx;
          break;
        case 'top-center':
          newHeight = Math.max(50, originalElement.height - dy);
          newY = originalElement.y + dy;
          break;
        case 'left-center':
          newWidth = Math.max(50, originalElement.width - dx);
          newX = originalElement.x + dx;
          break;
      }
      
      // Expand the image
      setGlobalIsLoading(true);
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: originalElement.id, changes: { isLoading: true } }] } });
      
      try {
        const newImageSrc = await geminiService.expandImage(originalElement, { width: newWidth, height: newHeight });
        dispatch({ 
          type: 'UPDATE_ELEMENTS', 
          payload: { 
            updates: [{ 
              id: originalElement.id, 
              changes: { 
                src: newImageSrc, 
                width: newWidth, 
                height: newHeight, 
                x: newX, 
                y: newY, 
                isLoading: false 
              } 
            }] 
          } 
        });
      } catch (error) {
        console.error("Image expansion failed:", error);
        alert("Sorry, the image expansion failed. Please try again.");
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: originalElement.id, changes: { isLoading: false } }] } });
      } finally {
        setGlobalIsLoading(false);
        setExpandingElementId(null);
      }
      
      interactionRef.current = null;
      redrawCanvas();
      return;
    }
    
    if (currentInteraction.type === 'draw') {
      const { elementType, shapeType, startX, startY, elementId, parentId } = currentInteraction;
      const worldPos = screenToWorld({ x: e.clientX, y: e.clientY });
      const width = Math.abs(worldPos.x - startX);
      const height = Math.abs(worldPos.y - startY);
      const x = Math.min(worldPos.x, startX);
      const y = Math.min(worldPos.y, startY);
      
      // Create the element
      let newElement: CanvasElement;
      
      if (elementType === 'frame') {
        newElement = {
          id: elementId,
          type: 'frame',
          parentId: null,
          x,
          y,
          width: Math.max(10, width),
          height: Math.max(10, height),
          rotation: 0,
          zIndex: state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1,
          backgroundColor: 'rgba(0, 0, 0, 0.1)'
        } as FrameElement;
      } else {
        newElement = {
          id: elementId,
          type: 'shape',
          parentId,
          x,
          y,
          width: Math.max(10, width),
          height: Math.max(10, height),
          rotation: 0,
          zIndex: state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1,
          shapeType: shapeType!,
          strokeColor: color,
          strokeWidth: 2,
          fillColor: 'transparent',
          flipHorizontal: false,
          flipVertical: false
        } as ShapeElement;
      }
      
      dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
      redrawCanvas();
      interactionRef.current = null;
      return;
    }
    
    if (currentInteraction.type === 'pen') {
      const { points, elementId, parentId } = currentInteraction;
      
      // Create SVG path from points
      if (points.length > 1) {
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x} ${points[i].y}`;
        }
        
        const newElement: DrawingElement = {
          id: elementId,
          type: 'drawing',
          parentId,
          x: Math.min(...points.map(p => p.x)),
          y: Math.min(...points.map(p => p.y)),
          width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
          height: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)),
          rotation: 0,
          zIndex: state.elements.length > 0 ? Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1,
          points,
          strokeColor: color,
          strokeWidth: 2,
          d
        };
        
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
        redrawCanvas();
      }
      
      interactionRef.current = null;
      return;
    }

    interactionRef.current = null;
    redrawCanvas();
  }, [brushState, expandingElementId, view.zoom, dispatch, screenToWorld, state.elements, color, redrawCanvas]);

  const handleBrushSubmit = async (prompt: string) => {
    if (!brushState) return;
    const { element, maskCanvas } = brushState;
    const elementId = element.id;
    
    const finalMask = document.createElement('canvas');
    finalMask.width = element.width; 
    finalMask.height = element.height;
    const finalCtx = finalMask.getContext('2d')!;
    finalCtx.fillStyle = 'black'; 
    finalCtx.fillRect(0, 0, finalMask.width, finalMask.height);
    Object.assign(finalCtx, { 
      strokeStyle: 'white', 
      lineWidth: 40 / view.zoom, 
      lineCap: 'round', 
      lineJoin: 'round' 
    });
    
    brushState.screenPointsStrokes.forEach(stroke => {
        if (stroke.length === 0) return;
        const relativePoints = stroke.map(p => screenToWorld(p)).map(p => ({ 
          x: p.x - element.x, 
          y: p.y - element.y 
        }));
        finalCtx.beginPath(); 
        finalCtx.moveTo(relativePoints[0].x, relativePoints[0].y);
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
        console.error("Image edit failed:", error); 
        alert("Sorry, the image edit failed. Please try again.");
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: { isLoading: false } }] } });
    } finally {
        setGlobalIsLoading(false);
        if (document.body.contains(maskCanvas)) document.body.removeChild(maskCanvas);
        setBrushState(null);
        setActiveTool(Tool.Select);
        redrawCanvas();
    }
  };

  const addImagesToCanvas = useCallback((files: File[]) => {
     const imagePromises = files.map((file, i) => {
         return new Promise<ImageElement>((resolve, reject) => {
             geminiService.fileToBase64(file)
                 .then(({ data, mimeType }) => {
                     if (!mimeType.startsWith('image/')) {
                         reject(new Error(`Unsupported file type: ${mimeType}`));
                         return;
                     }
                     
                     const src = `data:${mimeType};base64,${data}`;
                     const img = new Image();
                     img.onload = () => {
                         const center = screenToWorld({ 
                           x: window.innerWidth / 2, 
                           y: window.innerHeight / 2 
                         });
                         const nextZIndex = state.elements.length > 0 ? 
                           Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1;
                         const newElement: ImageElement = { 
                           id: crypto.randomUUID(), 
                           type: 'image', 
                           src, 
                           parentId: null, 
                           x: center.x + i * 20 - (img.width > 512 ? 256 : img.width/2), 
                           y: center.y + i * 20 - (img.height > 512 ? (256 * img.height / img.width)/2 : img.height/2), 
                           width: img.width > 512 ? 512 : img.width, 
                           height: img.height > 512 ? (512 * img.height / img.width) : img.height, 
                           rotation: 0, 
                           zIndex: nextZIndex 
                         };
                         resolve(newElement);
                     };
                     img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
                     img.src = src;
                 }).catch(reject);
         });
     });
     
     Promise.all(imagePromises)
         .then(newElements => { 
             if (newElements.length > 0) {
                 dispatch({ type: 'ADD_ELEMENTS', payload: { elements: newElements } });
                 redrawCanvas();
             }
         })
         .catch(error => { 
             console.error("Error loading images:", error);
             const errorMessage = error instanceof Error ? error.message : "There was an error loading some of the images.";
             alert(errorMessage);
         });
  }, [dispatch, screenToWorld, state.elements, redrawCanvas]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => { 
    e.preventDefault(); 
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); 
    if (files.length > 0) addImagesToCanvas(files); 
  }, [addImagesToCanvas]);
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { 
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')); 
    if (files.length > 0) addImagesToCanvas(files); 
    e.target.value = ''; 
  };
  
  const handleAIGenerate = async (prompt: string) => { 
    setGlobalIsLoading(true); 
    try { 
      const imageSrc = await geminiService.generateImage(prompt); 
      const img = new Image(); 
      img.onload = () => { 
        const center = screenToWorld({ 
          x: window.innerWidth / 2, 
          y: window.innerHeight / 2 
        }); 
        const nextZIndex = state.elements.length > 0 ? 
          Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1; 
        const newEl: ImageElement = { 
          id: crypto.randomUUID(), 
          type: 'image', 
          src: imageSrc, 
          parentId: null, 
          x: center.x-img.width/2, 
          y: center.y-img.height/2, 
          width: img.width, 
          height: img.height, 
          rotation: 0, 
          zIndex: nextZIndex 
        }; 
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newEl] }});
        redrawCanvas();
      }; 
      img.src = imageSrc; 
    } catch (error) { 
      console.error("Image generation failed:", error); 
      alert("Sorry, image generation failed. Please try again."); 
    } finally { 
      setGlobalIsLoading(false); 
    } 
  };
  
  const handleAIMerge = async (prompt: string) => { 
    const selectedIds = state.selectedElementIds; 
    const elementsToMerge = state.elements.filter((el): el is ImageElement => 
      selectedIds.includes(el.id) && el.type === 'image'
    ); 
    if (elementsToMerge.length < 2) return; 
    setGlobalIsLoading(true); 
    dispatch({ 
      type: 'UPDATE_ELEMENTS', 
      payload: { 
        updates: selectedIds.map(id => ({ id, changes: { isLoading: true } })) 
      }
    }); 
    try { 
      const imageUrls = elementsToMerge.map(el => el.src); 
      const newImageSrc = await geminiService.mergeImages(imageUrls, prompt); 
      const img = new Image(); 
      img.onload = () => { 
        const nextZIndex = state.elements.length > 0 ? 
          Math.max(...state.elements.map(el => el.zIndex)) + 1 : 1; 
        const newEl: ImageElement = { 
          id: crypto.randomUUID(), 
          type: 'image', 
          parentId: null, 
          src: newImageSrc, 
          x: elementsToMerge[0].x, 
          y: elementsToMerge[0].y, 
          width: img.width > 768 ? 768 : img.width, 
          height: img.height > 768 ? (768 * img.height/img.width) : img.height, 
          rotation: 0, 
          zIndex: nextZIndex 
        }; 
        dispatch({ type: 'DELETE_SELECTED_ELEMENTS' }); 
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newEl] }}); 
        redrawCanvas();
      }; 
      img.src = newImageSrc; 
    } catch (error) { 
      console.error("Image merge failed:", error); 
      alert("Sorry, image merge failed. Please try again."); 
      dispatch({ 
        type: 'UPDATE_ELEMENTS', 
        payload: { 
          updates: selectedIds.map(id => ({ id, changes: { isLoading: false } })) 
        }
      }); 
    } finally { 
      setGlobalIsLoading(false); 
    } 
  };

  // Add missing handler functions
  const handleBringToFront = useCallback(() => dispatch({ type: 'BRING_TO_FRONT' }), [dispatch]);
  const handleSendToBack = useCallback(() => dispatch({ type: 'SEND_TO_BACK' }), [dispatch]);
  const handleDuplicate = useCallback(() => dispatch({ type: 'DUPLICATE_SELECTED_ELEMENTS' }), [dispatch]);
  const handleDelete = useCallback(() => dispatch({ type: 'DELETE_SELECTED_ELEMENTS' }), [dispatch]);
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setView(v => ({ ...v, zoom: Math.max(0.1, Math.min(3, v.zoom + delta)) }));
      redrawCanvas();
    }
  }, [redrawCanvas]);
  
  const handleElementContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const screenPos = { x: e.clientX, y: e.clientY };
      const worldPos = screenToWorld(screenPos);
      
      // Find elements in reverse order (topmost first)
      const sortedElements = [...state.elements].sort((a, b) => b.zIndex - a.zIndex);
      const currentElement = sortedElements.find(el => isPointInElement(worldPos, el));
      if (!currentElement) return;
      
      if (!state.selectedElementIds.includes(currentElement.id)) {
        dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [currentElement.id], shiftKey: false } });
      }

      const items: ContextMenuItem[] = [
        { label: 'Edit with AI', action: () => {
            setAiEditPromptBar({ isOpen: true, elementToEdit: currentElement });
          }, icon: <Wand2 size={16}/> },
        ...(currentElement.type === 'image' ? [
          { label: 'Auto-Style Product Photo', action: () => setAutoStyleModal({ isOpen: true, elementToStyle: currentElement }), icon: <Camera size={16}/> },
          { label: 'Expand Image', action: () => setExpandingElementId(currentElement.id), icon: <Maximize size={16}/> }
        ] : []),
        { label: 'Bring to Front', action: handleBringToFront, icon: <BringToFront size={16}/> },
        { label: 'Send to Back', action: handleSendToBack, icon: <SendToBack size={16}/> },
        { label: 'Duplicate', action: handleDuplicate, icon: <Copy size={16} /> },
        { label: 'Delete', action: handleDelete, icon: <Trash2 size={16} /> },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [state.selectedElementIds, state.elements, dispatch, handleBringToFront, handleSendToBack, handleDuplicate, handleDelete, screenToWorld]);

  const handleAiEditSubmit = async (prompt: string) => {
      const { elementToEdit } = aiEditPromptBar;
      if (!elementToEdit) return;
      
      // Check if this is a brush operation
      const isBrushOperation = elementToEdit.type === 'image' && brushState !== null;
      
      const elementId = elementToEdit.id;
      setAiEditPromptBar({ isOpen: false, elementToEdit: null });
      setGlobalIsLoading(true);
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: elementId, changes: { isLoading: true }}] } });

      try {
        if (isBrushOperation && brushState) {
          // Handle brush operation
          const { element, maskCanvas } = brushState;
          
          const finalMask = document.createElement('canvas');
          finalMask.width = element.width; 
          finalMask.height = element.height;
          const finalCtx = finalMask.getContext('2d')!;
          finalCtx.fillStyle = 'black'; 
          finalCtx.fillRect(0, 0, finalMask.width, finalMask.height);
          Object.assign(finalCtx, { 
            strokeStyle: 'white', 
            lineWidth: 40 / view.zoom, 
            lineCap: 'round', 
            lineJoin: 'round' 
          });
          
          brushState.screenPointsStrokes.forEach(stroke => {
              if (stroke.length === 0) return;
              const relativePoints = stroke.map(p => screenToWorld(p)).map(p => ({ 
                x: p.x - element.x, 
                y: p.y - element.y 
              }));
              finalCtx.beginPath(); 
              finalCtx.moveTo(relativePoints[0].x, relativePoints[0].y);
              relativePoints.forEach(p => finalCtx.lineTo(p.x, p.y));
              finalCtx.stroke();
          });

          try {
              const maskData = finalMask.toDataURL('image/png');
              const newImageSrc = await geminiService.editImageWithMask(element.src, maskData, prompt);
              dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: { src: newImageSrc, isLoading: false } }] } });
          } catch (error) {
              console.error("Image edit failed:", error); 
              alert("Sorry, the image edit failed. Please try again.");
              dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: { isLoading: false } }] } });
          } finally {
              if (document.body.contains(maskCanvas)) document.body.removeChild(maskCanvas);
              setBrushState(null);
              setActiveTool(Tool.Select);
          }
        } else {
          // Handle regular AI edit
          let imageSrc = '';
          if (elementToEdit.type === 'image') {
            imageSrc = elementToEdit.src;
          }
          
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
              dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newImageElement] } });
              dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [newImageElement.id], shiftKey: false }});
              redrawCanvas();
          };
          img.src = newImageSrc;
        }
      } catch (error) {
        console.error("AI edit failed:", error); 
        alert(`Sorry, the AI edit failed. ${error}`);
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: elementId, changes: { isLoading: false }}] }});
      } finally {
        setGlobalIsLoading(false);
      }
  };

  // New function for auto-styling product photos
  const handleAutoStyleSubmit = async (prompt: string) => {
    const { elementToStyle } = autoStyleModal;
    if (!elementToStyle || elementToStyle.type !== 'image') return;
    
    const elementId = elementToStyle.id;
    setAutoStyleModal({ isOpen: false, elementToStyle: null });
    setGlobalIsLoading(true);
    dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: elementId, changes: { isLoading: true }}] } });

    try {
      const imageData = elementToStyle.src;
      const newImageSrc = await geminiService.autoStyleProductPhoto(imageData, prompt);
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const newImageElement: ImageElement = {
          id: crypto.randomUUID(),
          type: 'image',
          src: newImageSrc,
          parentId: elementToStyle.parentId,
          x: elementToStyle.x,
          y: elementToStyle.y,
          width: img.width,
          height: img.height,
          rotation: elementToStyle.rotation,
          zIndex: elementToStyle.zIndex + 1,
          isLoading: false
        };
        
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newImageElement] } });
        dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [newImageElement.id], shiftKey: false } });
        redrawCanvas();
      };
      img.src = newImageSrc;

    } catch (error) {
      console.error("Auto-style failed:", error);
      alert(`Sorry, the auto-styling failed. ${error instanceof Error ? error.message : 'Unknown error'}`);
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{id: elementId, changes: { isLoading: false }}] }});
    } finally {
      setGlobalIsLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return;
      if (e.key === ' ' && !e.repeat) { setIsSpacePressed(true); }
      if (e.key === 'Escape') { 
        if(interactionRef.current?.type === 'brushing') { interactionRef.current = null; }
        setActiveTool(Tool.Select);
        if (expandingElementId) setExpandingElementId(null);
        setEditingTextElementId(null);
      }
      if(e.key === 'Backspace') { handleDelete(); } 
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    const handleKeyUp = (e: globalThis.KeyboardEvent) => { if (e.key === ' ') { setIsSpacePressed(false); } };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }
  }, [handleDelete, undo, activeTool, expandingElementId, setActiveTool]);
  
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
    }
  }, [activeTool, brushState]);

  // Add this useEffect to clear brush when navigating away from canvas
  useEffect(() => {
    return () => {
      // Cleanup function that runs when component unmounts
      if (brushState && document.body.contains(brushState.maskCanvas)) {
        document.body.removeChild(brushState.maskCanvas);
      }
      setBrushState(null);
    };
  }, [brushState]);

  const showGenerateBar = activeTool === Tool.Generate;
  const showMergeBar = activeTool === Tool.Merge && state.selectedElementIds.filter(id => state.elements.find(el => el.id === id)?.type === 'image').length > 1;
  const showBrushBar = aiEditPromptBar.isOpen && aiEditPromptBar.elementToEdit?.type === 'image' && brushState !== null;
  const cursorStyle = isSpacePressed || activeTool === Tool.Hand ? 'grab' : CURSOR_MAP[activeTool] || 'default';

  return (
    <div className="w-full h-full relative overflow-hidden" ref={canvasRef}
      onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleElementContextMenu}
      style={{ cursor: cursorStyle }}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
      <canvas
        ref={htmlCanvasRef}
        className="w-full h-full"
      />
      <button onClick={(e) => { e.preventDefault(); undo(); }} disabled={!canUndo} className="absolute top-6 left-24 z-20 p-3 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all" title="Undo (Ctrl+Z)"><Undo size={20} /></button>
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      
      {showGenerateBar && <AIPromptBar onSubmit={handleAIGenerate} placeholder="A futuristic cityscape at sunset..." buttonText="Generate" isLoading={globalIsLoading} />}
      {showMergeBar && <AIPromptBar onSubmit={handleAIMerge} placeholder="Merge images into a surreal collage..." buttonText="Merge" isLoading={globalIsLoading} />}
      {showBrushBar && <AIPromptBar onSubmit={handleBrushSubmit} placeholder="Describe the edit for the selected area..." buttonText="Apply Edit" isLoading={globalIsLoading} />}
      <PromptModal 
        isOpen={aiEditPromptBar.isOpen} 
        onClose={() => {
          setAiEditPromptBar({isOpen: false, elementToEdit: null});
        }} 
        onSubmit={handleAiEditSubmit} 
        isLoading={globalIsLoading} 
      />
      <AutoStyleModal
        isOpen={autoStyleModal.isOpen}
        onClose={() => setAutoStyleModal({ isOpen: false, elementToStyle: null })}
        onSubmit={handleAutoStyleSubmit}
        isLoading={globalIsLoading}
      />
    </div>
  );
};

export default HtmlCanvas;