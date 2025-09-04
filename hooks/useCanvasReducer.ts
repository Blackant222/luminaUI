import { useReducer, useCallback } from 'react';
import { CanvasElement, CanvasState, CanvasAction } from '../types';

const getNextZIndex = (elements: CanvasElement[]) => {
    if (elements.length === 0) return 1;
    return Math.max(...elements.map(el => el.zIndex)) + 1;
};

const canvasReducer = (state: CanvasState, action: CanvasAction): CanvasState => {
    switch (action.type) {
        case 'ADD_ELEMENTS': {
            const maxZ = getNextZIndex(state.elements);
            const newElements = action.payload.elements.map((el, i) => ({
                ...el,
                zIndex: maxZ + i,
            }));
            return {
                ...state,
                elements: [...state.elements, ...newElements],
                selectedElementIds: newElements.map(el => el.id),
            };
        }
        case 'UPDATE_ELEMENTS': {
            const { updates } = action.payload;
            const updateMap = new Map(updates.map(u => [u.id, u.changes]));
            
            const originalElementsMap = new Map(state.elements.map(el => [el.id, el]));
            
            const movedParentIds = updates
                .filter(u => u.changes.x !== undefined || u.changes.y !== undefined)
                .map(u => u.id);

            if (movedParentIds.length > 0) {
                const deltas = new Map(movedParentIds.map(id => {
                    const original = originalElementsMap.get(id)!;
                    const changes = updateMap.get(id)!;
                    return [id, { dx: (changes.x ?? original.x) - original.x, dy: (changes.y ?? original.y) - original.y }];
                }));
                
                const getAllDescendants = (parentId: string): string[] => {
                    const children = state.elements.filter(el => el.parentId === parentId);
                    return [...children.map(c => c.id), ...children.flatMap(c => getAllDescendants(c.id))];
                };
                
                const allDescendantsToMove = new Set(movedParentIds.flatMap(id => getAllDescendants(id)));

                allDescendantsToMove.forEach(descendantId => {
                    const descendant = originalElementsMap.get(descendantId)!;
                    const parent = originalElementsMap.get(descendant.parentId!)!;
                    
                    if (deltas.has(parent.id)) {
                        const delta = deltas.get(parent.id)!;
                         const existingChanges = updateMap.get(descendantId) || {};
                        updateMap.set(descendantId, {
                            ...existingChanges,
                            x: descendant.x + delta.dx,
                            y: descendant.y + delta.dy,
                        });
                    }
                });
            }

            return {
                ...state,
                elements: state.elements.map(el => {
                    if (updateMap.has(el.id)) {
                        // FIX: Add a type assertion to prevent TypeScript from widening the discriminated union type
                        // when spreading the element with its partial changes.
                        return { ...el, ...updateMap.get(el.id) } as CanvasElement;
                    }
                    return el;
                }),
            };
        }
        case 'DELETE_SELECTED_ELEMENTS': {
            const idsToDelete = new Set(state.selectedElementIds);
            let allIdsToDelete = new Set(state.selectedElementIds);

            let childrenToFind = [...state.selectedElementIds];
            while (childrenToFind.length > 0) {
                const parentId = childrenToFind.pop()!;
                const children = state.elements.filter(el => el.parentId === parentId);
                children.forEach(child => {
                    if (!allIdsToDelete.has(child.id)) {
                        allIdsToDelete.add(child.id);
                        childrenToFind.push(child.id);
                    }
                });
            }

            return {
                ...state,
                elements: state.elements.filter(el => !allIdsToDelete.has(el.id)),
                selectedElementIds: [],
            };
        }
        case 'SELECT_ELEMENTS': {
            const { ids, shiftKey } = action.payload;
            const newSelection = new Set(shiftKey ? state.selectedElementIds : []);
            ids.forEach(id => {
                if (shiftKey && newSelection.has(id)) {
                    newSelection.delete(id);
                } else {
                    newSelection.add(id);
                }
            });
            return { ...state, selectedElementIds: Array.from(newSelection) };
        }
        case 'CLEAR_SELECTION':
            return { ...state, selectedElementIds: [] };
        case 'BRING_TO_FRONT': {
            const maxZ = getNextZIndex(state.elements);
            return {
                ...state,
                elements: state.elements.map(el => state.selectedElementIds.includes(el.id) ? { ...el, zIndex: maxZ } : el)
            };
        }
        case 'SEND_TO_BACK': {
            const selectedIds = new Set(state.selectedElementIds);
            const selected = state.elements.filter(el => selectedIds.has(el.id));
            const unselected = state.elements.filter(el => !selectedIds.has(el.id));
            // FIX: Use a type assertion to work around a TypeScript limitation where spreading a discriminated union 
            // can lead to type widening. This ensures the reordered array maintains the CanvasElement[] type.
            const reordered = [...selected, ...unselected].map((el, i) => ({ ...el, zIndex: i + 1 } as CanvasElement));
            return { ...state, elements: reordered };
        }
        case 'DUPLICATE_SELECTED_ELEMENTS': {
            const maxZ = getNextZIndex(state.elements);
            const elementsToDuplicate = state.elements.filter(el => state.selectedElementIds.includes(el.id));
            const newElements = elementsToDuplicate.map((el, i) => ({
                ...el,
                id: crypto.randomUUID(),
                x: el.x + 20,
                y: el.y + 20,
                zIndex: maxZ + i,
            }));
            return {
                ...state,
                elements: [...state.elements, ...newElements],
                selectedElementIds: newElements.map(el => el.id),
            };
        }
        case 'REORDER_LAYERS':
            return { ...state, elements: action.payload.reorderedElements };
        case 'LOAD_PROJECT': {
            // Load project data, replacing the current state
            return {
                elements: action.payload.elements,
                selectedElementIds: [],
            };
        }
        default:
            return state;
    }
};

type HistoryState = {
    past: CanvasState[];
    present: CanvasState;
    future: CanvasState[];
};

const historyReducer = (state: HistoryState, action: CanvasAction): HistoryState => {
    const { past, present, future } = state;

    if (action.type === 'UNDO') {
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        return { past: newPast, present: previous, future: [present, ...future] };
    }

    if (action.type === 'REDO') {
        if (future.length === 0) return state;
        const next = future[0];
        const newFuture = future.slice(1);
        return { past: [...past, present], present: next, future: newFuture };
    }

    const newPresent = canvasReducer(present, action);

    if (newPresent === present) {
        return state;
    }

    const isOverwrite = action.type === 'UPDATE_ELEMENTS' && action.payload.overwriteHistory;

    const newPast = isOverwrite ? past.slice(0, past.length -1) : past;

    return {
        past: [...newPast, present],
        present: newPresent,
        future: [],
    };
};

export const useCanvasReducer = (initialState: CanvasState) => {
    const [state, dispatch] = useReducer(historyReducer, {
        past: [],
        present: initialState,
        future: [],
    });

    const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
    const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

    return {
        state: state.present,
        dispatch,
        undo,
        redo,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
    };
};