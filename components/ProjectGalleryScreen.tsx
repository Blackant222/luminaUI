import React, { useState, useEffect } from 'react';
import { View } from '../App';
import { ArrowLeft } from 'lucide-react';
import { getProjects, getProject } from '../services/projectsService';
// @ts-ignore
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../contexts/ProjectContext';

type Project = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type ProjectGalleryScreenProps = {
  setView: (view: View) => void;
};

const ProjectGalleryScreen: React.FC<ProjectGalleryScreenProps> = ({ setView }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { setCurrentProject } = useProject();

  useEffect(() => {
    const fetchProjects = async () => {
      if (user) {
        try {
          const userProjects = await getProjects(user.id);
          setProjects(userProjects);
        } catch (error) {
          console.error('Error fetching projects:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProjects();
  }, [user]);

  const handleOpenProject = async (projectId: string, projectName: string) => {
    try {
      // Set the current project in context
      setCurrentProject(projectId, projectName);
      // Navigate to the editor
      setView('editor');
      // In a real implementation, you would also load the project data
      // and pass it to the editor through context or state
    } catch (error) {
      console.error('Error opening project:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full h-full p-10">
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-white/70 hover:text-white mb-8">
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>
      <h2 className="text-3xl font-bold text-white mb-4">Project Gallery</h2>
      
      {loading ? (
        <div className="h-[calc(100%-100px)] flex items-center justify-center bg-black/10 rounded-lg">
          <p className="text-white/50">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="h-[calc(100%-100px)] flex items-center justify-center bg-black/10 rounded-lg">
          <p className="text-white/50">No projects yet. Create your first project!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div 
              key={project.id} 
              className="bg-white/5 rounded-lg p-6 border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-white">{project.name}</h3>
              </div>
              <div className="flex justify-between text-sm text-white/60">
                <span>Created: {formatDate(project.created_at)}</span>
                <span>Updated: {formatDate(project.updated_at)}</span>
              </div>
              <div className="mt-4 flex justify-end">
                <button 
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm transition-colors"
                  onClick={() => handleOpenProject(project.id, project.name)}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectGalleryScreen;