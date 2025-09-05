import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  CanvasElement,
  CanvasState,
  Tool,
  Point,
  ImageElement,
  CanvasAction,
  Interaction,
  FrameElement,
  ShapeElement,
  DrawingElement,
  TextElement,
} from '../types';
import { editImageWithPrompt, urlToBase64, generateImage, autoStyleProductPhoto, mergeImages, editImageWithMask } from '../services/geminiService';
import ContextMenu from './ContextMenu';
import { AiEditModal } from './AiEditModal';
import AIPromptBar from './AIPromptBar';
import AutoStyleModal from './AutoStyleModal';
import { CURSOR_MAP, SHAPE_TOOLS } from '../constants';
import { getSvgPathFromStroke } from '../utils/getSvgPathFromStroke';
import getStroke from 'perfect-freehand';

// #region Helper Functions
const screenToWorld = (point: Point, viewState: { pan: Point; zoom: number }): Point => {
  return {
    x: (point.x - viewState.pan.x) / viewState.zoom,
    y: (point.y - viewState.pan.y) / viewState.zoom,
  };
};

const isPointInElement = (point: Point, element: CanvasElement): boolean => {
  const { x, y, width, height } = element;
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
};

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
  color: string;
}

const HtmlCanvas: React.FC<CanvasProps> = ({
  activeTool,
  setActiveTool,
  state,
  dispatch,
  color,
}) => {
  const { elements } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [viewState, setViewState] = useState({ pan: { x: 0, y: 0 }, zoom: 1 });
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [aiEditModalOpen, setAiEditModalOpen] = useState(false);
  const [autoStyleModalOpen, setAutoStyleModalOpen] = useState(false);
  const [promptBarConfig, setPromptBarConfig] = useState<{ onSubmit: (prompt: string) => void; placeholder: string; buttonText: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elementToEdit, setElementToEdit] = useState<ImageElement | null>(null);
  const [resizingCorner, setResizingCorner] = useState<string | null>(null);
  const [editingTextElement, setEditingTextElement] = useState<TextElement | null>(null);

  const getFrameAtPoint = (point: Point): FrameElement | null => {
    return elements
        .filter((el): el is FrameElement => el.type === 'frame')
        .sort((a, b) => b.zIndex - a.zIndex)
        .find(frame => isPointInElement(point, frame)) || null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') setIsSpacePressed(true);
      if (e.key === 'Escape') {
        if (editingTextElement) setEditingTextElement(null);
        if (promptBarConfig) setPromptBarConfig(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingTextElement, promptBarConfig]);

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

  const drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / viewState.zoom;
    const gridSize = 50;

    const left = -viewState.pan.x / viewState.zoom;
    const top = -viewState.pan.y / viewState.zoom;
    const right = (canvas.width - viewState.pan.x) / viewState.zoom;
    const bottom = (canvas.height - viewState.pan.y) / viewState.zoom;

    for (let x = Math.floor(left / gridSize) * gridSize; x < right; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }

    for (let y = Math.floor(top / gridSize) * gridSize; y < bottom; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
    ctx.restore();
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(viewState.pan.x, viewState.pan.y);
    ctx.scale(viewState.zoom, viewState.zoom);
    
    drawGrid(ctx, canvas);

    const drawElement = (element: CanvasElement) => {
        ctx.save();
        const parent = elements.find(p => p.id === element.parentId);
        if (parent && parent.type === 'frame') {
            ctx.beginPath();
            ctx.rect(parent.x, parent.y, parent.width, parent.height);
            ctx.clip();
        }

        if (element.isLoading) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(element.x, element.y, element.width, element.height);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.strokeRect(element.x, element.y, element.width, element.height);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', element.x + element.width / 2, element.y + element.height / 2);
        } else {
            switch (element.type) {
                case 'image':
                    const img = loadedImages[element.src];
                    if (img) ctx.drawImage(img, element.x, element.y, element.width, element.height);
                    break;
                case 'frame':
                    ctx.fillStyle = element.backgroundColor;
                    ctx.fillRect(element.x, element.y, element.width, element.height);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.strokeRect(element.x, element.y, element.width, element.height);
                    break;
                case 'shape':
                    ctx.fillStyle = element.fillColor;
                    ctx.strokeStyle = element.strokeColor;
                    ctx.lineWidth = element.strokeWidth;
                    ctx.beginPath();
                    switch(element.shapeType) {
                        case 'rectangle':
                            ctx.rect(element.x, element.y, element.width, element.height);
                            break;
                        case 'ellipse':
                            ctx.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, 0, 0, 2 * Math.PI);
                            break;
                    }
                    ctx.fill();
                    ctx.stroke();
                    break;
                case 'drawing':
                    const pathData = getSvgPathFromStroke(getStroke(element.points, { size: element.strokeWidth }));
                    const path = new Path2D(pathData);
                    ctx.fillStyle = element.strokeColor;
                    ctx.fill(path);
                    break;
                case 'text':
                    ctx.fillStyle = element.color;
                    ctx.font = `${element.fontSize}px ${element.fontFamily}`;
                    ctx.fillText(element.content, element.x, element.y + element.fontSize);
                    break;
            }
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

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const worldPoint = screenToWorld({ x: e.clientX, y: e.clientY }, viewState);
    const clickedElement = elements.find(el => isPointInElement(worldPoint, el));
    if (clickedElement && clickedElement.type === 'text') {
        setEditingTextElement(clickedElement);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!editingTextElement) return;
    const updatedElement = { ...editingTextElement, content: e.target.value };
    setEditingTextElement(updatedElement);
    dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: updatedElement.id, changes: { content: e.target.value } }] } });
  };

  const handleGenerateSubmit = async (prompt: string) => {
    setIsLoading(true);
    const worldPoint = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, viewState);
    const parentFrame = getFrameAtPoint(worldPoint);
    const newElementId = crypto.randomUUID();
    const loadingElement: ImageElement = {
        id: newElementId,
        type: 'image',
        src: '',
        x: worldPoint.x - 150,
        y: worldPoint.y - 150,
        width: 300,
        height: 300,
        parentId: parentFrame?.id || null,
        rotation: 0,
        zIndex: 0,
        isLoading: true,
    };
    dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [loadingElement] } });

    try {
        const newImageSrc = await generateImage(prompt);
        const newImage = new Image();
        newImage.src = newImageSrc;
        newImage.onload = () => {
            const updatedElement = {
                src: newImage.src,
                width: newImage.width,
                height: newImage.height,
                isLoading: false,
            };
            dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: newElementId, changes: updatedElement }] } });
        }
    } catch (error) {
        console.error(error);
        dispatch({ type: 'DELETE_SELECTED_ELEMENTS' }); // a bit aggressive
    }
    setIsLoading(false);
    setPromptBarConfig(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingTextElement) return;
    const startPoint = { x: e.clientX, y: e.clientY };
    setDragStart(startPoint);
    setIsDragging(true);

    if (activeTool === Tool.Hand) return;

    const worldPoint = screenToWorld(startPoint, viewState);
    const parentFrame = getFrameAtPoint(worldPoint);

    if (activeTool === Tool.Frame) {
        const newElementId = crypto.randomUUID();
        setInteraction({ type: 'draw', elementType: 'frame', startX: worldPoint.x, startY: worldPoint.y, elementId: newElementId, parentId: parentFrame?.id || null, drawMode: 'corner' });
        return;
    }

    if (SHAPE_TOOLS.map(t => t.id).includes(activeTool)) {
        if (!parentFrame) return alert("Shapes can only be drawn inside a frame.");
        const newElementId = crypto.randomUUID();
        setInteraction({ type: 'draw', elementType: 'shape', shapeType: activeTool.toLowerCase() as ShapeElement['shapeType'], startX: worldPoint.x, startY: worldPoint.y, elementId: newElementId, parentId: parentFrame.id, drawMode: 'corner' });
        return;
    }

    if (activeTool === Tool.Pen) {
        if (!parentFrame) return alert("Drawing can only be done inside a frame.");
        const newElementId = crypto.randomUUID();
        setInteraction({ type: 'pen', points: [worldPoint], elementId: newElementId, parentId: parentFrame.id });
        return;
    }

    if (activeTool === Tool.Text) {
        if (!parentFrame) return alert("Text can only be added inside a frame.");
        const newElement: TextElement = { id: crypto.randomUUID(), type: 'text', x: worldPoint.x, y: worldPoint.y, width: 150, height: 40, content: 'Text', fontSize: 24, color, fontFamily: 'Arial', parentId: parentFrame.id, rotation: 0, zIndex: 0 };
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
        setActiveTool(Tool.Select);
        return;
    }
    
    if (activeTool === Tool.Upload) {
        fileInputRef.current?.click();
        setActiveTool(Tool.Select);
        return;
    }
    
    if (activeTool === Tool.Generate) {
        setPromptBarConfig({ onSubmit: handleGenerateSubmit, placeholder: 'Enter a prompt to generate an image...', buttonText: 'Generate' });
        setActiveTool(Tool.Select);
        return;
    }

    if (activeTool === Tool.Brush) {
        const clickedElement = elements.find(el => el.type === 'image' && isPointInElement(worldPoint, el));
        if (clickedElement) {
            setInteraction({ type: 'brushing', elementId: clickedElement.id, points: [worldPoint] });
        } else {
            alert('Brush tool can only be used on an image.');
        }
        return;
    }

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

    if (isSpacePressed || activeTool === Tool.Hand) {
      setViewState(vs => ({ ...vs, pan: { x: vs.pan.x + dx, y: vs.pan.y + dy }}));
      setDragStart(point);
      return;
    }

    const worldPoint = screenToWorld({ x: e.clientX, y: e.clientY }, viewState);

    if (interaction?.type === 'brushing') {
        const brushCanvas = brushCanvasRef.current;
        if (!brushCanvas) return;
        const ctx = brushCanvas.getContext('2d');
        if (!ctx) return;

        const imageElement = elements.find(el => el.id === interaction.elementId) as ImageElement;
        if (!imageElement) return;

        const localPoint = { x: worldPoint.x - imageElement.x, y: worldPoint.y - imageElement.y };
        
        ctx.lineTo(localPoint.x, localPoint.y);
        ctx.stroke();
        return;
    }

    if (interaction?.type === 'draw') {
        const { startX, startY, elementId, parentId } = interaction;
        const x = Math.min(startX, worldPoint.x);
        const y = Math.min(startY, worldPoint.y);
        const width = Math.abs(startX - worldPoint.x);
        const height = Math.abs(startY - worldPoint.y);
        
        let newElement: CanvasElement;

        if (interaction.elementType === 'frame') {
            newElement = { id: elementId, type: 'frame', x, y, width, height, parentId, rotation: 0, zIndex: 0, backgroundColor: 'rgba(255, 255, 255, 0.1)' };
        } else {
            newElement = { id: elementId, type: 'shape', shapeType: interaction.shapeType!, x, y, width, height, parentId, rotation: 0, zIndex: 0, strokeColor: color, strokeWidth: 2, fillColor: 'transparent', flipHorizontal: false, flipVertical: false };
        }
        
        const existingElement = elements.find(el => el.id === elementId);
        if (existingElement) {
            dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementId, changes: newElement }], overwriteHistory: true } });
        } else {
            dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
        }
        return;
    }
    
    if (interaction?.type === 'pen') {
        const newPoints = [...interaction.points, worldPoint];
        setInteraction({ ...interaction, points: newPoints });
        const pathData = getSvgPathFromStroke(getStroke(newPoints, { size: 16 }));
        const newElement: DrawingElement = { id: interaction.elementId, type: 'drawing', points: newPoints, d: pathData, parentId: interaction.parentId, x: Math.min(...newPoints.map(p=>p.x)), y: Math.min(...newPoints.map(p=>p.y)), width: Math.max(...newPoints.map(p=>p.x)) - Math.min(...newPoints.map(p=>p.x)), height: Math.max(...newPoints.map(p=>p.y)) - Math.min(...newPoints.map(p=>p.y)), rotation: 0, zIndex: 0, strokeColor: color, strokeWidth: 16 };
        const existingElement = elements.find(el => el.id === interaction.elementId);
        if (existingElement) {
            dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: interaction.elementId, changes: newElement }], overwriteHistory: true } });
        } else {
            dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
        }
        return;
    }

    if (resizingCorner && state.selectedElementIds.length === 1) {
        const selectedElement = elements.find(el => el.id === state.selectedElementIds[0]) as ImageElement;
        if (!selectedElement) return;

        let { x, y, width, height } = selectedElement;

        switch (resizingCorner) {
            case 'se': width = worldPoint.x - x; height = worldPoint.y - y; break;
            case 'sw': width = x + width - worldPoint.x; x = worldPoint.x; height = worldPoint.y - y; break;
            case 'ne': width = worldPoint.x - x; height = y + height - worldPoint.y; y = worldPoint.y; break;
            case 'nw': width = x + width - worldPoint.x; height = y + height - worldPoint.y; x = worldPoint.x; y = worldPoint.y; break;
        }
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: state.selectedElementIds[0], changes: { width, height, x, y } }] }});

    } else if (activeTool === Tool.Select && state.selectedElementIds.length > 0) {
      const delta = { x: dx / viewState.zoom, y: dy / viewState.zoom };
      const updates = state.selectedElementIds.map(id => {
        const el = elements.find(e => e.id === id)!;
        return { id, changes: { x: el.x + delta.x, y: el.y + delta.y }};
      });
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates, overwriteHistory: true } });
      setDragStart(point);
    }
  };

  const handleMouseUp = async () => {
    if (interaction?.type === 'brushing') {
        const brushCanvas = brushCanvasRef.current;
        if (!brushCanvas) return;
        const mask = brushCanvas.toDataURL();
        const imageElement = elements.find(el => el.id === interaction.elementId) as ImageElement;
        if (!imageElement) return;

        setPromptBarConfig({
            onSubmit: async (prompt) => {
                const { data: imageBase64 } = await urlToBase64(imageElement.src);
                const newImageSrc = await editImageWithMask(imageBase64, mask, prompt);
                const newImage = new Image();
                newImage.src = newImageSrc;
                newImage.onload = () => {
                    dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: imageElement.id, changes: { src: newImageSrc, width: newImage.width, height: newImage.height } }] } });
                };
                setPromptBarConfig(null);
            },
            placeholder: 'Enter a prompt for the brushed area...',
            buttonText: 'Edit',
        });

        const ctx = brushCanvas.getContext('2d');
        ctx?.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    }

    if (interaction) {
        if (interaction.elementId) {
            dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [interaction.elementId], shiftKey: false } });
        }
        setActiveTool(Tool.Select);
        setInteraction(null);
    }
    setIsDragging(false);
    setResizingCorner(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const point = { x: e.clientX, y: e.clientY };
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? viewState.zoom * zoomFactor : viewState.zoom / zoomFactor;
    const worldPoint = screenToWorld(point, viewState);
    const newPan = { x: point.x - worldPoint.x * newZoom, y: point.y - worldPoint.y * newZoom };
    setViewState({ pan: newPan, zoom: newZoom });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const point = screenToWorld({ x: e.clientX, y: e.clientY }, viewState);
    const clickedElement = elements.find(el => isPointInElement(point, el));
    if (clickedElement) {
        if (!state.selectedElementIds.includes(clickedElement.id)) {
            dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [clickedElement.id], shiftKey: false } });
        }
        setContextMenu({ x: e.clientX, y: e.clientY, elementId: clickedElement.id });
    } else {
      setContextMenu(null);
    }
  };

  const handleAiEdit = async () => {
    if (state.selectedElementIds.length === 0) return;
    const element = elements.find(el => el.id === state.selectedElementIds[0]);
    if (!element) return;

    if (element.type === 'image') {
        setElementToEdit(element);
        setAiEditModalOpen(true);
    } else if (element.type === 'frame') {
        alert('Frame editing not implemented yet');
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
      dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: elementToEdit.id, changes: { src: newImageSrc } }] } });
    };
  };

  const handleAutoStyle = async (prompt: string) => {
    const selectedImageId = state.selectedElementIds[0];
    const imageElement = elements.find(el => el.id === selectedImageId) as ImageElement;
    if (!imageElement) return;

    const { data: imageBase64 } = await urlToBase64(imageElement.src);
    const newImageSrc = await autoStyleProductPhoto(imageBase64, prompt);
    const newImage = new Image();
    newImage.src = newImageSrc;
    newImage.onload = () => {
        dispatch({ type: 'UPDATE_ELEMENTS', payload: { updates: [{ id: selectedImageId, changes: { src: newImageSrc, width: newImage.width, height: newImage.height } }] } });
    };
    setAutoStyleModalOpen(false);
  };

  const handleMerge = async (prompt: string) => {
    const imageUrls = await Promise.all(
        state.selectedElementIds.map(async id => {
            const el = elements.find(e => e.id === id) as ImageElement;
            const { data } = await urlToBase64(el.src);
            return data;
        })
    );

    const newImageSrc = await mergeImages(imageUrls, prompt);
    const newImage = new Image();
    newImage.src = newImageSrc;
    newImage.onload = () => {
        const worldPoint = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, viewState);
        const parentFrame = getFrameAtPoint(worldPoin t);
        const newElement: ImageElement = {
            id: crypto.randomUUID(),
            type: 'image',
            src: newImage.src,
            x: worldPoint.x - newImage.width / 2,
            y: worldPoint.y - newImage.height / 2,
            width: newImage.width,
            height: newImage.height,
            parentId: parentFrame?.id || null,
            rotation: 0,
            zIndex: 0,
        };
        dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
    }
    setPromptBarConfig(null);
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const newImage = new Image();
            newImage.src = event.target?.result as string;
            newImage.onload = () => {
                const worldPoint = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, viewState);
                const parentFrame = getFrameAtPoint(worldPoint);
                const newElement: ImageElement = {
                    id: crypto.randomUUID(),
                    type: 'image',
                    src: newImage.src,
                    x: worldPoint.x - newImage.width / 2,
                    y: worldPoint.y - newImage.height / 2,
                    width: newImage.width,
                    height: newImage.height,
                    parentId: parentFrame?.id || null,
                    rotation: 0,
                    zIndex: 0,
                };
                dispatch({ type: 'ADD_ELEMENTS', payload: { elements: [newElement] } });
            }
        }
        reader.readAsDataURL(file);
    }
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
        onDoubleClick={handleDoubleClick}
        style={{ cursor: isSpacePressed ? 'grabbing' : CURSOR_MAP[activeTool] || 'default' }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
        <canvas
            ref={brushCanvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1000 }}
        />
        {editingTextElement && (
            <textarea
                value={editingTextElement.content}
                onChange={handleTextChange}
                onBlur={() => setEditingTextElement(null)}
                autoFocus
                style={{
                    position: 'absolute',
                    left: (editingTextElement.x * viewState.zoom + viewState.pan.x),
                    top: (editingTextElement.y * viewState.zoom + viewState.pan.y),
                    width: editingTextElement.width * viewState.zoom,
                    height: editingTextElement.height * viewState.zoom,
                    fontSize: editingTextElement.fontSize * viewState.zoom,
                    fontFamily: editingTextElement.fontFamily,
                    color: editingTextElement.color,
                    border: '1px solid #6D35FF',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    background: 'transparent',
                    resize: 'none',
                    overflow: 'hidden',
                    zIndex: 1000,
                }}
            />
        )}
      </div>
      {promptBarConfig && (
        <AIPromptBar
            onSubmit={promptBarConfig.onSubmit}
            placeholder={promptBarConfig.placeholder}
            buttonText={promptBarConfig.buttonText}
            isLoading={isLoading}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: 'Edit with AI', action: handleAiEdit, disabled: state.selectedElementIds.length !== 1 },
            { label: 'Auto-Style Product', action: () => setAutoStyleModalOpen(true), disabled: state.selectedElementIds.length !== 1 || elements.find(el => el.id === state.selectedElementIds[0])?.type !== 'image' },
            { label: 'Merge Images', action: () => setPromptBarConfig({ onSubmit: handleMerge, placeholder: 'Enter a prompt for merging the images...', buttonText: 'Merge' }), disabled: state.selectedElementIds.length < 2 || state.selectedElementIds.some(id => elements.find(el => el.id === id)?.type !== 'image') },
            { label: 'Bring to Front', action: () => dispatch({ type: 'BRING_TO_FRONT' }) },
            { label: 'Send to Back', action: () => dispatch({ type: 'SEND_TO_BACK' }) },
            { label: 'Duplicate', action: () => dispatch({ type: 'DUPLICATE_SELECTED_ELEMENTS' }) },
            { label: 'Delete', action: () => dispatch({ type: 'DELETE_SELECTED_ELEMENTS' }) },
          ]}
        />
      )}
      <AiEditModal
        isOpen={aiEditModalOpen}
        onClose={() => setAiEditModalOpen(false)}
        onSubmit={handleAiEditSubmit}
      />
      <AutoStyleModal
        isOpen={autoStyleModalOpen}
        onClose={() => setAutoStyleModalOpen(false)}
        onSubmit={handleAutoStyle}
        isLoading={isLoading}
      />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
    </>
  );
};

export default HtmlCanvas;
