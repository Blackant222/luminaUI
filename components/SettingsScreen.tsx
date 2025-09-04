import React from 'react';
import { View } from '../App';
import { ArrowLeft } from 'lucide-react';

type SettingsScreenProps = {
  setView: (view: View) => void;
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({ setView }) => {
  return (
    <div className="w-full h-full p-10">
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-white/70 hover:text-white mb-8">
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>
      <h2 className="text-3xl font-bold text-white mb-4">Profile & Settings</h2>
      <div className="h-[calc(100%-100px)] flex items-center justify-center bg-black/10 rounded-lg">
        <p className="text-white/50">User settings and billing information will be here.</p>
      </div>
    </div>
  );
};

export default SettingsScreen;
