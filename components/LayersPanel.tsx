import React, { useState, DragEvent, useMemo, useRef, MouseEvent } from 'react';
import { CanvasElement } from '../types';
import { Image, Square, Pen, Type, ChevronDown, ChevronRight, ChevronsUpDown, GripVertical } from 'lucide-react';

type LayersPanelProps = {
  elements: CanvasElement[];
  selectedElementIds: string[];
  onSelectLayer: (id: string, shiftKey: boolean) => void;
  onReorderLayers: (elements: CanvasElement[]) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
};

type TreeNode = {
  element: CanvasElement;
  children: TreeNode[];
};

const LayerIcon = ({ type }: { type: CanvasElement['type'] }) => {
    switch (type) {
        case 'image': return <Image size={16} className="text-white/50" />;
        case 'frame': return <Square size={16} className="text-white/50" />;
        case 'drawing': return <Pen size={16} className="text-white/50" />;
        case 'shape': return <Square size={16} className="text-white/50" />;
        case 'text': return <Type size={16} className="text-white/50" />;
        default: return null;
    }
};

const RenderLayerTree = ({
    nodes,
    level,
    selectedElementIds,
    collapsedIds,
    onToggleCollapse,
    ...rest
}: {
    nodes: TreeNode[];
    level: number;
    selectedElementIds: string[];
    collapsedIds: Set<string>;
    onToggleCollapse: (id: string) => void;
    onSelectLayer: (e: React.MouseEvent, id: string) => void;
    onDragStart: (e: DragEvent, id: string) => void;
    onDragOver: (e: DragEvent, id: string) => void;
    onDragEnd: (e: DragEvent) => void;
    onDrop: (e: DragEvent, id: string) => void;
}) => {
    return (
        <>
        {nodes.map(node => (
            <div key={node.element.id} data-layer-id={node.element.id}>
                <div
                    onClick={(e) => rest.onSelectLayer(e, node.element.id)}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                    className={`w-full p-2 pr-3 flex items-center gap-2 cursor-pointer transition-colors rounded-lg ${selectedElementIds.includes(node.element.id) ? 'bg-white/20' : 'hover:bg-white/10'}`}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); rest.onDragStart(e, node.element.id); }}
                    onDragOver={(e) => { e.stopPropagation(); rest.onDragOver(e, node.element.id); }}
                    onDragEnd={(e) => { e.stopPropagation(); rest.onDragEnd(e); }}
                    onDrop={(e) => { e.stopPropagation(); rest.onDrop(e, node.element.id); }}
                >
                    <GripVertical size={16} className="text-white/50 cursor-grab" />
                    {node.children.length > 0 ? (
                        <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.element.id); }} className="p-0.5 rounded-sm hover:bg-white/10">
                            {collapsedIds.has(node.element.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                    ) : <div className="w-[18px]" />}
                    <LayerIcon type={node.element.type} />
                    <span className="text-sm text-white/90 truncate">{node.element.type.charAt(0).toUpperCase() + node.element.type.slice(1)}</span>
                </div>
                {!collapsedIds.has(node.element.id) && (
                    <RenderLayerTree nodes={node.children} level={level + 1} selectedElementIds={selectedElementIds} collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse} {...rest} />
                )}
            </div>
        ))}
        </>
    );
};


const LayersPanel: React.FC<LayersPanelProps> = ({ elements, selectedElementIds, onSelectLayer, onReorderLayers, position, setPosition, isCollapsed, setIsCollapsed }) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);


  const onToggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  const tree = useMemo(() => {
    const elementMap = new Map(elements.map(el => [el.id, el]));
    const nodeMap = new Map(elements.map(el => [el.id, { element: el, children: [] as TreeNode[] }]));
    const rootNodes: TreeNode[] = [];

    for (const element of elements) {
      const node = nodeMap.get(element.id)!;
      if (element.parentId && nodeMap.has(element.parentId)) {
        nodeMap.get(element.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
    
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => b.element.zIndex - a.element.zIndex);
      nodes.forEach(node => sortNodes(node.children));
    };

    sortNodes(rootNodes);
    
    return rootNodes;
  }, [elements]);

  const handleDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: DragEvent) => e.preventDefault();
  const handleDragEnd = () => setDraggedId(null);

  const handleDrop = (e: DragEvent, dropTargetId: string) => {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('text/plain');
    if (!draggedItemId || draggedItemId === dropTargetId) return;

    let elementsCopy = JSON.parse(JSON.stringify(elements));
    const draggedElement = elementsCopy.find((el: CanvasElement) => el.id === draggedItemId);
    const dropTargetElement = elementsCopy.find((el: CanvasElement) => el.id === dropTargetId);
    if (!draggedElement || !dropTargetElement) return;
    
    const draggedIndex = elements.findIndex(el => el.id === draggedItemId);
    const dropIndex = elements.findIndex(el => el.id === dropTargetId);
    
    let newParentId = dropTargetElement.type === 'frame' ? dropTargetId : dropTargetElement.parentId;
    
    const reordered = [...elements];
    const [moved] = reordered.splice(draggedIndex, 1);
    moved.parentId = newParentId;
    reordered.splice(dropIndex, 0, moved);
    
    onReorderLayers(reordered.map((el, i) => ({ ...el, zIndex: i })));
    setDraggedId(null);
  };
  
  const handlePanelDragStart = (e: MouseEvent<HTMLDivElement>) => {
      dragStartPos.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
      };
      window.addEventListener('mousemove', handlePanelDrag);
      window.addEventListener('mouseup', handlePanelDragEnd);
  };
  
  const handlePanelDrag = (e: globalThis.MouseEvent) => {
      setPosition({
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y,
      });
  };
  
  const handlePanelDragEnd = () => {
      window.removeEventListener('mousemove', handlePanelDrag);
      window.removeEventListener('mouseup', handlePanelDragEnd);
  };

  return (
    <aside 
      ref={panelRef}
      className="absolute z-10 w-64 flex flex-col"
      style={{ top: position.y, left: position.x, touchAction: 'none' }}
    >
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-2 flex flex-col items-center gap-2 shadow-lg h-full">
        <div 
            className="w-full flex items-center justify-between p-2 cursor-grab"
            onMouseDown={handlePanelDragStart}
        >
            <h3 className="text-white/80 font-semibold">Layers</h3>
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 rounded-md hover:bg-white/10">
                {isCollapsed ? <ChevronsUpDown size={16} /> : <ChevronDown size={16} />}
            </button>
        </div>
        {!isCollapsed && (
            <div className="w-full flex-grow overflow-y-auto pr-1 space-y-1 max-h-[60vh]">
               <RenderLayerTree
                  nodes={tree}
                  level={0}
                  selectedElementIds={selectedElementIds}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                  onSelectLayer={(e, id) => onSelectLayer(id, e.shiftKey)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
               />
            </div>
        )}
      </div>
    </aside>
  );
};

export default LayersPanel;
