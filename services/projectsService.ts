import { createClient } from '@supabase/supabase-js';
import { CanvasState } from '../types';

// Initialize Supabase client
const supabase = createClient(
  // @ts-ignore
  import.meta.env.VITE_SUPABASE_URL,
  // @ts-ignore
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Project type
export type Project = {
  id: string;
  user_id: string;
  name: string;
  canvas_state: CanvasState | null;
  created_at: string;
  updated_at: string;
};

// Get all projects for the current user
export const getProjects = async (userId: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data as Project[];
};

// Get a specific project by ID
export const getProject = async (id: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Project;
};

// Create a new project
export const createProject = async (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();
  
  if (error) throw error;
  return data as Project;
};

// Update an existing project
export const updateProject = async (id: string, updates: Partial<Project>) => {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Project;
};

// Delete a project
export const deleteProject = async (id: string) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Save current canvas state as a new project or update existing one
export const saveProject = async (userId: string, projectName: string, canvasState: CanvasState) => {
  // First, try to find an existing project with the same name for this user
  const { data: existingProjects, error: fetchError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)
    .eq('name', projectName)
    .limit(1);

  if (fetchError) throw fetchError;

  if (existingProjects && existingProjects.length > 0) {
    // Update existing project
    return await updateProject(existingProjects[0].id, { canvas_state: canvasState });
  } else {
    // Create new project
    const newProject: Omit<Project, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      name: projectName,
      canvas_state: canvasState,
    };

    return await createProject(newProject);
  }
};

export default supabase;