import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tool, CanvasElement, CanvasState } from '../types';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import HelpWizard from './HelpWizard';
import LayersPanel from './LayersPanel';
import { useCanvasReducer } from '../hooks/useCanvasReducer';
import { TOOLS, SHAPE_TOOLS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../contexts/ProjectContext';
import { saveProject, getProject } from '../services/projectsService';

type EditorScreenProps = {
  onLogout: () => void;
  onExit: () => void;
};

const EditorScreen: React.FC<EditorScreenProps> = ({ onLogout, onExit }) => {
  const [activeTool, setActiveTool] = useState<Tool>(Tool.Select);
  const [uploadTrigger, setUploadTrigger] = useState(0);
  const [color, setColor] = useState('#000000');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const { state, dispatch, undo, canUndo } = useCanvasReducer({ elements: [], selectedElementIds: [] });
  const { user } = useAuth();
  const { currentProjectId, currentProjectName, setCurrentProject, clearCurrentProject } = useProject();
  const hasInitialized = useRef(false);

  const [layersPanelPosition, setLayersPanelPosition] = useState({ 
    x: window.innerWidth - 256 - 24, // 256px width, 24px margin
    y: 80 
  });
  const [isLayersPanelCollapsed, setIsLayersPanelCollapsed] = useState(false);

  // Load project data if there's a current project
  useEffect(() => {
    const loadProject = async () => {
      if (currentProjectId && !hasInitialized.current) {
        hasInitialized.current = true;
        try {
          const project = await getProject(currentProjectId);
          if (project.canvas_state) {
            // Load the project data into the canvas using the new action
            dispatch({ type: 'LOAD_PROJECT', payload: { elements: project.canvas_state.elements } });
          }
        } catch (error) {
          console.error('Error loading project:', error);
        }
      }
    };

    loadProject();
  }, [currentProjectId, dispatch]);

  // Clear the current project when the component unmounts
  useEffect(() => {
    return () => {
      clearCurrentProject();
    };
  }, [clearCurrentProject]);

  const handleSaveProject = useCallback(async () => {
    if (!user) {
      setSaveMessage({ type: 'error', text: 'You must be logged in to save projects' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      let projectName = currentProjectName;
      
      // If this is a new project, get a name from the user
      if (!currentProjectId) {
        projectName = prompt('Enter a name for your project:', 'My Project') || 'My Project';
        if (!projectName) {
          setIsSaving(false);
          return;
        }
      }

      // Save or update the project
      if (currentProjectId) {
        // Update existing project
        await saveProject(user.id, projectName, state);
        setSaveMessage({ type: 'success', text: 'Project updated successfully!' });
      } else {
        // Create new project
        const newProject = await saveProject(user.id, projectName, state);
        // Set the current project in context
        setCurrentProject(newProject.id, newProject.name);
        setSaveMessage({ type: 'success', text: 'Project saved successfully!' });
      }
      
      // Clear the message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving project:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save project. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [user, currentProjectId, currentProjectName, state, setCurrentProject]);

  const handleExit = useCallback(() => {
    // Clear the current project context
    clearCurrentProject();
    // Call the original onExit function
    onExit();
  }, [onExit, clearCurrentProject]);

  const handleSetActiveTool = useCallback((tool: Tool) => {
    if (tool === Tool.Upload) {
      setUploadTrigger(c => c + 1);
    } else {
      setActiveTool(tool);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return;

      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveProject();
        return;
      }

      const toolMap: { [key: string]: Tool } = {};
      [...TOOLS, ...SHAPE_TOOLS].forEach(tool => {
        if(tool.shortcut) toolMap[tool.shortcut.toLowerCase()] = tool.id;
      });

      if (toolMap[e.key.toLowerCase()]) {
        e.preventDefault();
        setActiveTool(toolMap[e.key.toLowerCase()]);
      } else if (e.key === 'Escape') {
        setActiveTool(Tool.Select);
        dispatch({ type: 'CLEAR_SELECTION' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, handleSaveProject]);
  
  const handleReorderLayers = useCallback((reorderedElements: CanvasElement[]) => dispatch({ type: 'REORDER_LAYERS', payload: { reorderedElements } }), [dispatch]);
  const handleSelectLayer = useCallback((id: string, shiftKey: boolean) => dispatch({ type: 'SELECT_ELEMENTS', payload: { ids: [id], shiftKey } }), [dispatch]);

  return (
    <div className="w-full h-full relative">
      <Toolbar 
        activeTool={activeTool} 
        setActiveTool={handleSetActiveTool} 
        onLogout={onLogout} 
        onExit={handleExit}
        onSave={handleSaveProject}
        isSaving={isSaving}
        color={color}
        setColor={setColor}
      />
      <main className="w-full h-full">
        <Canvas 
          activeTool={activeTool} 
          setActiveTool={setActiveTool} 
          uploadTrigger={uploadTrigger}
          color={color}
          state={state}
          dispatch={dispatch}
          undo={undo}
          canUndo={canUndo}
        />
      </main>
      <LayersPanel 
        elements={state.elements} 
        selectedElementIds={state.selectedElementIds} 
        onSelectLayer={handleSelectLayer}
        onReorderLayers={handleReorderLayers}
        position={layersPanelPosition}
        setPosition={setLayersPanelPosition}
        isCollapsed={isLayersPanelCollapsed}
        setIsCollapsed={setIsLayersPanelCollapsed}
      />
      <HelpWizard />
      {saveMessage && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
          saveMessage.type === 'success' 
            ? 'bg-green-500/20 border border-green-500/30 text-green-200' 
            : 'bg-red-500/20 border border-red-500/30 text-red-200'
        }`}>
          {saveMessage.text}
        </div>
      )}
    </div>
  );
};

export default EditorScreen;