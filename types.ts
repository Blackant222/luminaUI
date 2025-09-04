export enum Tool {
  Select = 'SELECT',
  Hand = 'HAND',
  Brush = 'BRUSH',
  Pen = 'PEN',
  Frame = 'FRAME',
  Merge = 'MERGE',
  Generate = 'GENERATE',
  Upload = 'UPLOAD',
  Rectangle = 'RECTANGLE',
  Line = 'LINE',
  Arrow = 'ARROW',
  Ellipse = 'ELLIPSE',
  Polygon = 'POLYGON',
  Star = 'STAR',
  Text = 'TEXT',
  Group = 'GROUP',
}

export type Point = { x: number; y: number };

export interface BaseElement {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation: number;
  isLoading?: boolean;
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  backgroundColor: string;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
}

export interface DrawingElement extends BaseElement {
  type: 'drawing';
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
  d: string; // SVG path data
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star';
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface TextElement extends BaseElement {
    type: 'text';
    content: string;
    fontSize: number;
    color: string;
    fontFamily: string;
}

export type CanvasElement = FrameElement | ImageElement | DrawingElement | ShapeElement | TextElement;

export type CanvasState = {
  elements: CanvasElement[];
  selectedElementIds: string[];
};

export type CanvasAction =
  | { type: 'ADD_ELEMENTS'; payload: { elements: CanvasElement[] } }
  | { type: 'UPDATE_ELEMENTS'; payload: { updates: Array<{ id: string; changes: Partial<CanvasElement> }>; overwriteHistory?: boolean } }
  | { type: 'DELETE_SELECTED_ELEMENTS' }
  | { type: 'SELECT_ELEMENTS'; payload: { ids: string[]; shiftKey: boolean } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'BRING_TO_FRONT' }
  | { type: 'SEND_TO_BACK' }
  | { type: 'DUPLICATE_SELECTED_ELEMENTS' }
  | { type: 'REORDER_LAYERS'; payload: { reorderedElements: CanvasElement[] } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_PROJECT'; payload: { elements: CanvasElement[] } };

export type Interaction = 
  | { type: 'draw', elementType: 'frame' | 'shape' | 'text', shapeType?: ShapeElement['shapeType'], startX: number, startY: number, elementId: string, parentId: string | null, drawMode: 'corner' | 'center' | 'line' }
  | { type: 'pen', points: Point[], elementId: string, parentId: string | null }
  | { type: 'move', startViewX: number, startViewY: number, originalElements: CanvasElement[] }
  | { type: 'resize', handle: string, startX: number, startY: number, originalElement: CanvasElement }
  | { type: 'expand', handle: string, startX: number, startY: number, originalElement: ImageElement }
  | { type: 'pan', startX: number, startY: number }
  | { type: 'brushing' }
  | null;

export type ContextMenuItem = {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
};