import React, { useState } from 'react';

type AutoStyleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
};

const AutoStyleModal: React.FC<AutoStyleModalProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('studio-white');
  const [customPrompt, setCustomPrompt] = useState('');

  const presetStyles = [
    { id: 'studio-white', name: 'Studio White', description: 'Clean white background with professional lighting' },
    { id: 'natural-light', name: 'Natural Light', description: 'Soft, natural lighting with subtle shadows' },
    { id: 'luxury-lifestyle', name: 'Luxury Lifestyle', description: 'Elegant setting with premium materials' },
    { id: 'outdoor', name: 'Outdoor Scene', description: 'Natural outdoor environment with scenic backdrop' },
  ];

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalPrompt = '';
    
    // Add preset style description to the prompt
    const selectedPreset = presetStyles.find(style => style.id === selectedStyle);
    if (selectedPreset) {
      finalPrompt = selectedPreset.description;
    }
    
    // Append custom prompt if provided
    if (customPrompt.trim()) {
      finalPrompt = finalPrompt ? `${finalPrompt}. ${customPrompt}` : customPrompt;
    }
    
    onSubmit(finalPrompt);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 flex flex-col items-center gap-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white">Auto-Style Product Photo</h2>
        <p className="text-sm text-white/70 text-center">Transform your product image into a professional studio shot</p>
        
        <form className="w-full flex flex-col gap-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-white/90">Choose a preset style:</label>
            <div className="grid grid-cols-2 gap-3">
              {presetStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedStyle === style.id
                      ? 'border-[#6D35FF] bg-[#6D35FF]/20'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium text-white text-sm">{style.name}</div>
                  <div className="text-xs text-white/70 mt-1">{style.description}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white/90">Custom styling instructions (optional):</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., 'add golden sunset lighting' or 'place on marble surface'"
              className="w-full bg-black/20 text-white placeholder:text-[#9481AA]/70 rounded-lg px-4 py-3 border border-transparent focus:border-[#6D35FF] focus:outline-none focus:ring-2 focus:ring-[#6D35FF]/50 transition-all min-h-[100px] resize-y"
            />
          </div>
          
          <div className="flex gap-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-black/20 text-white/80 font-medium rounded-lg py-3 hover:bg-black/30 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full bg-[#6D35FF] text-white font-semibold rounded-lg py-3 hover:bg-opacity-90 transition-colors disabled:bg-opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Styling...' : 'Apply Style'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AutoStyleModal;