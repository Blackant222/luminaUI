import React, { useState, useEffect } from 'react';
import { View } from '../App';
import { Plus, Image, Settings, HelpCircle, LayoutGrid } from 'lucide-react';
import { getProjects } from '../services/projectsService';
import { useAuth } from '../hooks/useAuth';

type Project = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type DashboardScreenProps = {
  setView: (view: View) => void;
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({ setView }) => {
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchRecentProjects = async () => {
      if (user) {
        try {
          const userProjects = await getProjects(user.id);
          // Get the 4 most recently updated projects
          const recent = userProjects.slice(0, 4);
          setRecentProjects(recent);
        } catch (error) {
          console.error('Error fetching recent projects:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchRecentProjects();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full h-full flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-black/10 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-10">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs><linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{stopColor: '#D8B4FE'}} /><stop offset="100%" style={{stopColor: '#6D35FF'}} /></linearGradient></defs>
              <path d="M24 0L28.8 19.2L48 24L28.8 28.8L24 48L19.2 28.8L0 24L19.2 19.2L24 0Z" fill="url(#logoGrad)"/><path d="M24 14.4L26.4 21.6L33.6 24L26.4 26.4L24 33.6L21.6 26.4L14.4 24L21.6 21.6L24 14.4Z" fill="#29212A"/><path d="M24 16L25.9 22.1L32 24L25.9 25.9L24 32L22.1 25.9L16 24L22.1 22.1L24 16Z" fill="white"/>
            </svg>
            <h1 className="text-xl font-medium text-white/90">Lumina AI</h1>
          </div>

          <nav className="flex flex-col gap-2">
            <button onClick={() => setView('dashboard')} className="flex items-center gap-3 p-3 rounded-lg bg-white/10 text-white font-semibold">
              <LayoutGrid size={20} />
              <span>Dashboard</span>
            </button>
            <button onClick={() => setView('gallery')} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-white/70 transition-colors">
              <Image size={20} />
              <span>Project Gallery</span>
            </button>
          </nav>
        </div>
        <div className="flex flex-col gap-2">
           <button onClick={() => setView('help')} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-white/70 transition-colors">
              <HelpCircle size={20} />
              <span>Help & Docs</span>
            </button>
            <button onClick={() => setView('settings')} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-white/70 transition-colors">
              <Settings size={20} />
              <span>Settings</span>
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-white/60">Welcome back, let's create something amazing.</p>
        </header>

        <section>
          <h3 className="text-xl font-semibold text-white/90 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <button 
              onClick={() => setView('editor')}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center justify-center gap-4 text-center aspect-square hover:border-white/20 hover:bg-white/10 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-[#6D35FF] flex items-center justify-center transition-transform group-hover:scale-110">
                <Plus size={32} />
              </div>
              <h4 className="font-semibold text-white">New Project</h4>
              <p className="text-sm text-white/60">Start with a blank canvas</p>
            </button>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-white/90">Recent Projects</h3>
            <button 
              onClick={() => setView('gallery')}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              View All
            </button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/5 rounded-2xl border border-white/10 p-6 aspect-square animate-pulse"></div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="text-center text-white/50 p-8 bg-black/10 rounded-lg">
              <p>You don't have any projects yet.</p>
              <p className="text-sm">Create a new project to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setView('editor')}
                  className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-left hover:border-white/20 hover:bg-white/10 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                      {project.name}
                    </h4>
                  </div>
                  <div className="text-xs text-white/60">
                    Updated {formatDate(project.updated_at)}
                  </div>
                </button>
              ))}
              {recentProjects.length < 4 && (
                <button 
                  onClick={() => setView('editor')}
                  className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center justify-center gap-2 text-center aspect-square hover:border-white/20 hover:bg-white/10 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#6D35FF] flex items-center justify-center transition-transform group-hover:scale-110">
                    <Plus size={20} />
                  </div>
                  <p className="text-sm text-white/70">New Project</p>
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DashboardScreen;