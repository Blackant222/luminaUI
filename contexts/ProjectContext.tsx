import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CanvasState } from '../types';

type ProjectContextType = {
  currentProjectId: string | null;
  currentProjectName: string | null;
  setCurrentProject: (id: string | null, name: string | null) => void;
  clearCurrentProject: () => void;
  loadProjectData: (canvasState: CanvasState) => void;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

  const setCurrentProject = (id: string | null, name: string | null) => {
    setCurrentProjectId(id);
    setCurrentProjectName(name);
  };

  const clearCurrentProject = () => {
    setCurrentProjectId(null);
    setCurrentProjectName(null);
  };

  const loadProjectData = (canvasState: CanvasState) => {
    // This function would be called to load project data into the canvas
    // In a real implementation, this would dispatch an action to update the canvas state
    console.log('Loading project data:', canvasState);
  };

  return (
    <ProjectContext.Provider value={{
      currentProjectId,
      currentProjectName,
      setCurrentProject,
      clearCurrentProject,
      loadProjectData
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};