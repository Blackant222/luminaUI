import React, { useState, useCallback } from 'react';
import AuthScreen from './components/AuthScreen';
import EditorScreen from './components/EditorScreen';
import DashboardScreen from './components/DashboardScreen';
import ProjectGalleryScreen from './components/ProjectGalleryScreen';
import SettingsScreen from './components/SettingsScreen';
import HelpScreen from './components/HelpScreen';
import { useAuth } from './hooks/useAuth';
import { ProjectProvider } from './contexts/ProjectContext';

export type View = 'dashboard' | 'editor' | 'gallery' | 'settings' | 'help';

function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const handleLoginSuccess = useCallback(() => {
    // Login state is now handled by the auth hook
    setCurrentView('dashboard');
  }, []);
  
  const handleLogout = useCallback(() => {
    // Logout is handled by the auth service
  }, []);

  const renderContent = () => {
    // Show loading state while checking auth
    if (loading) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-white/50">Loading...</p>
        </div>
      );
    }

    // If user is not authenticated, show auth screen
    if (!user) {
      return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardScreen setView={setCurrentView} />;
      case 'editor':
        return <EditorScreen onLogout={handleLogout} onExit={() => setCurrentView('dashboard')} />;
      case 'gallery':
        return <ProjectGalleryScreen setView={setCurrentView} />;
      case 'settings':
        return <SettingsScreen setView={setCurrentView} />;
      case 'help':
        return <HelpScreen setView={setCurrentView} />;
      default:
        return <DashboardScreen setView={setCurrentView} />;
    }
  };

  return (
    <ProjectProvider>
      <div className="w-screen h-screen bg-gradient-to-br from-[#4C4C4C] to-[#29212A] text-white font-sans overflow-hidden">
        {renderContent()}
      </div>
    </ProjectProvider>
  );
}

export default App;