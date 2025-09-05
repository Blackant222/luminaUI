import React, { useRef, useEffect, useReducer, useState, useCallback } from 'react';
import {
  CanvasElement,
  CanvasState,
  Tool,
  Point,
  BrushState,
  AiPromptBarConfig,
  ImageElement,
  Element,
} from '../types';
import { useCanvasReducer } from '../hooks/useCanvasReducer';
import { ProjectContext } from '../contexts/ProjectContext';
import { getGeminiImage } from '../services/geminiService';
import { ContextMenu } from './ContextMenu';
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
 * Converts world coordinates to screen coordinates.
 */
const worldToScreen = (point: Point, viewState: { pan: Point; zoom: number }): Point => {
  return {
    x: point.x * viewState.zoom + viewState.pan.x,
    y: point.y * viewState.zoom + viewState.pan.y,
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
  isSpacePressed: boolean;
  setBrushState: (state: BrushState) => void;
  setAiPromptBarConfig: (config: AiPromptBarConfig | null) => void;
}

export const HtmlCanvas: React.FC<CanvasProps> = ({
  activeTool,
  isSpacePressed,
  setAiPromptBarConfig,
}) => {
  const { state, dispatch } = useCanvasReducer();
  const { elements, viewState } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [aiEditModalOpen, setAiEditModalOpen] = useState(false);
  const [elementToEdit, setElementToEdit] = useState<ImageElement | null>(null);
  const [resizingCorner, setResizingCorner] = useState<string | null>(null);


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
                if (element.image) {
                    ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
                }
                break;
            // Other element types drawing logic here...
        }
        ctx.restore();
    };

    // Create a map for quick lookup
    const elementMap = new Map(elements.map(el => [el.id, el]));
    const drawnElements = new Set<string>();

    // Draw elements respecting hierarchy
    elements.forEach(element => {
        if (!element.parentId) {
            const drawWithChildren = (el: CanvasElement) => {
                if (drawnElements.has(el.id)) return;
                drawElement(el);
                drawnElements.add(el.id);
                const children = elements.filter(child => child.parentId === el.id);
                children.forEach(drawWithChildren);
            }
            drawWithChildren(element);
        }
    });


    ctx.restore();
  }, [elements, viewState]);

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

    if (activeTool === 'select' && clickedElement && clickedElement.type === 'image') {
        const corner = getResizeCorner(worldPoint, clickedElement as ImageElement, viewState.zoom);
        if (corner) {
            setResizingCorner(corner);
            dispatch({ type: 'SELECT_ELEMENT', payload: clickedElement.id });
            return;
        }
    }

    if (activeTool === 'select' && clickedElement) {
      dispatch({ type: 'SELECT_ELEMENT', payload: clickedElement.id });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const point = { x: e.clientX, y: e.clientY };
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;

    if (isSpacePressed || activeTool === 'hand') {
      dispatch({ type: 'PAN', payload: { x: dx, y: dy } });
      setDragStart(point);
    } else if (resizingCorner && state.selectedElementId) {
        const selectedElement = elements.find(el => el.id === state.selectedElementId) as ImageElement;
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
        dispatch({ type: 'RESIZE_ELEMENT', payload: { id: state.selectedElementId, width, height, x, y } });

    } else if (activeTool === 'select' && state.selectedElementId) {
      const delta = {
        x: dx / viewState.zoom,
        y: dy / viewState.zoom,
      };
      dispatch({ type: 'MOVE_ELEMENT', payload: delta });
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
    dispatch({ type: 'ZOOM', payload: { zoom: newZoom, point } });
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
    if (!elementToEdit || !elementToEdit.image) return;

    // This is a placeholder for getting the image data.
    // In a real scenario, you might need to draw the image to a temporary canvas
    // to get its base64 representation if you don't already have it.
    const imageAsBase64 = (elementToEdit.image as any).src;

    const newImageSrc = await getGeminiImage(prompt, imageAsBase64);
    const newImage = new Image();
    newImage.src = newImageSrc;
    newImage.onload = () => {
      dispatch({
        type: 'UPDATE_ELEMENT',
        payload: { ...elementToEdit, image: newImage },
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
          actions={[
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