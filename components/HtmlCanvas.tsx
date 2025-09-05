import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  CanvasElement,
  CanvasState,
  Tool,
  Point,
  ImageElement,
  CanvasAction,
} from '../types';
import { editImageWithPrompt, urlToBase64 } from '../services/geminiService';
import ContextMenu from './ContextMenu';
import { AiEditModal } from './AiEditModal';

// #region Helper Functions
/**
 * Converts screen coordinates to world coordinates.
 */
const screenToWorld = (point: Point, viewState: { pan: Point; zoom: number }): Point => {
  return {
    x: (point.x - viewState.pan.x) / viewState.zoom,
    y: (point.y - viewState.pan.y) / viewState.zoom,
  };
};

/**
 * Checks if a point is inside an element's boundaries.
 */
const isPointInElement = (point: Point, element: CanvasElement): boolean => {
  const { x, y, width, height } = element;
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
};

/**
 * Gets the corner of a resizable element that the mouse is over.
 */
const getResizeCorner = (point: Point, element: ImageElement, zoom: number): string | null => {
    const handleSize = 8 / zoom;
    const corners = {
        nw: { x: element.x, y: element.y },
        ne: { x: element.x + element.width, y: element.y },
        sw: { x: element.x, y: element.y + element.height },
        se: { x: element.x + element.width, y: element.y + element.height },
    };

    for (const [name, corner] of Object.entries(corners)) {
        if (
            point.x >= corner.x - handleSize &&
            point.x <= corner.x + handleSize &&
            point.y >= corner.y - handleSize &&
            point.y <= corner.y + handleSize
        ) {
            return name;
        }
    }
    return null;
};
// #endregion

export interface CanvasProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  state: CanvasState;
  dispatch: React.Dispatch<CanvasAction>;
}

const HtmlCanvas: React.FC<CanvasProps> = ({
  activeTool,
  state,
  dispatch,
}) => {
  const { elements } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [viewState, setViewState] = useState({ pan: { x: 0, y: 0 }, zoom: 1 });
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [aiEditModalOpen, setAiEditModalOpen] = useState(false);
  const [elementToEdit, setElementToEdit] = useState<ImageElement | null>(null);
  const [resizingCorner, setResizingCorner] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    elements.forEach(element => {
        if (element.type === 'image' && element.src && !loadedImages[element.src]) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = element.src;
            img.onload = () => {
                setLoadedImages(prev => ({ ...prev, [element.src]: img }));
            };
        }
    });
  }, [elements, loadedImages]);


  /**
   * Redraws the entire canvas based on the current state.
   * It handles layer hierarchy and masking.
   */
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewState.pan.x, viewState.pan.y);
    ctx.scale(viewState.zoom, viewState.zoom);

    const drawElement = (element: CanvasElement) => {
        ctx.save();
        // Apply clipping from parent
        const parent = elements.find(p => p.id === element.parentId);
        if (parent && parent.type === 'frame') {
            ctx.beginPath();
            ctx.rect(parent.x, parent.y, parent.width, parent.height);
            ctx.clip();
        }

        switch (element.type) {
            case 'image':
                const img = loadedImages[element.src];
                if (img) {
                    ctx.drawImage(img, element.x, element.y, element.width, element.height);
                }
                break;
            // Other element types drawing logic here...
        }
        ctx.restore();
    };

    const elementMap = new Map(elements.map(el => [el.id, el]));
    const drawnElements = new Set<string>();

    elements.sort((a, b) => a.zIndex - b.zIndex).forEach(element => {
        if (!element.parentId || !elementMap.has(element.parentId)) {
            const drawWithChildren = (el: CanvasElement) => {
                if (drawnElements.has(el.id)) return;
                drawElement(el);
                drawnElements.add(el.id);
                const children = elements.filter(child => child.parentId === el.id).sort((a,b) => a.zIndex - b.zIndex);
                children.forEach(drawWithChildren);
            }
            drawWithChildren(element);
        }
    });


    ctx.restore();
  }, [elements, viewState, loadedImages]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      redrawCanvas();
    }
  }, [redrawCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const startPoint = { x: e.clientX, y: e.clientY };
    setDragStart(startPoint);
    setIsDragging(true);

    const worldPoint = screenToWorld(startPoint, viewState);
    const clickedElement = elements.find(el => isPointInElement(worldPoint, el));

    if (activeTool === Tool.Select && clickedElement) {
        if (clickedElement.type === 'image') {
            const corner = getResizeCorner(worldPoint, clickedElement as ImageElement, viewState.zoom);
            if (corner) {
                setResizingCorner(corner);
                dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [clickedElement.id], shiftKey: e.shiftKey } });
                return;
            }
        }
        dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [clickedElement.id], shiftKey: e.shiftKey } });
    } else if (activeTool === Tool.Select && !clickedElement) {
        dispatch({ type: 'CLEAR_SELECTION' });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const point = { x: e.clientX, y: e.clientY };
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;

    if (isSpacePressed) {
      setViewState(vs => ({ ...vs, pan: { x: vs.pan.x + dx, y: vs.pan.y + dy }}));
      setDragStart(point);
    } else if (resizingCorner && state.selectedElementIds.length === 1) {
        const selectedElement = elements.find(el => el.id === state.selectedElementIds[0]) as ImageElement;
        if (!selectedElement) return;

        const worldPoint = screenToWorld(point, viewState);
        let { x, y, width, height } = selectedElement;

        switch (resizingCorner) {
            case 'se':
                width = worldPoint.x - x;
                height = worldPoint.y - y;
                break;
            case 'sw':
                width = x + width - worldPoint.x;
                x = worldPoint.x;
                height = worldPoint.y - y;
                break;
            case 'ne':
                width = worldPoint.x - x;
                height = y + height - worldPoint.y;
                y = worldPoint.y;
                break;
            case 'nw':
                width = x + width - worldPoint.x;
                height = y + height - worldPoint.y;
                x = worldPoint.x;
                y = worldPoint.y;
                break;
        }
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: state.selectedElementIds[0], changes: { width, height, x, y } }] }});

    } else if (activeTool === Tool.Select && state.selectedElementIds.length > 0) {
      const delta = {
        x: dx / viewState.zoom,
        y: dy / viewState.zoom,
      };
      const updates = state.selectedElementIds.map(id => {
        const el = elements.find(e => e.id === id)!;
        return { id, changes: { x: el.x + delta.x, y: el.y + delta.y }};
      });
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates, overwriteHistory: true } });
      setDragStart(point);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizingCorner(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const point = { x: e.clientX, y: e.clientY };
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? viewState.zoom * zoomFactor : viewState.zoom / zoomFactor;
    
    const worldPoint = screenToWorld(point, viewState);
    const newPan = {
      x: point.x - worldPoint.x * newZoom,
      y: point.y - worldPoint.y * newZoom,
    };

    setViewState({ pan: newPan, zoom: newZoom });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const point = screenToWorld({ x: e.clientX, y: e.clientY }, viewState);
    const clickedElement = elements.find(el => isPointInElement(point, el));

    if (clickedElement && clickedElement.type === 'image') {
      setContextMenu({ x: e.clientX, y: e.clientY, elementId: clickedElement.id });
    } else {
      setContextMenu(null);
    }
  };

  const handleAiEdit = (elementId: string) => {
    const element = elements.find(el => el.id === elementId) as ImageElement;
    if (element) {
      setElementToEdit(element);
      setAiEditModalOpen(true);
    }
    setContextMenu(null);
  };

  const handleAiEditSubmit = async (prompt: string) => {
    if (!elementToEdit || !elementToEdit.src) return;

    const { data: imageBase64 } = await urlToBase64(elementToEdit.src);

    const newImageSrc = await editImageWithPrompt(imageBase64, prompt);
    const newImage = new Image();
    newImage.crossOrigin = "anonymous";
    newImage.src = newImageSrc;
    newImage.onload = () => {
      setLoadedImages(prev => ({...prev, [newImageSrc]: newImage}));
      dispatch({
        type: 'UPDATE_ELEMENTS',
        payload: { updates: [{ id: elementToEdit.id, changes: { src: newImageSrc } }] },
      });
    };
  };

  return (
    <>
      <div
        ref={interactionRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        style={{ cursor: isSpacePressed ? 'grabbing' : 'auto' }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: 'Edit with AI', action: () => handleAiEdit(contextMenu.elementId) },
          ]}
        />
      )}
      <AiEditModal
        isOpen={aiEditModalOpen}
        onClose={() => setAiEditModalOpen(false)}
        onSubmit={handleAiEditSubmit}
      />
    </>
  );
};

export default HtmlCanvas;