import React, { useState } from 'react';

type PromptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
};

const PromptModal: React.FC<PromptModalProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 flex flex-col items-center gap-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white">Describe your edit</h2>
        <p className="text-sm text-white/70 text-center">Tell the AI what changes to make to the selected area.</p>
        <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'make it a sunny day'"
            className="w-full bg-black/20 text-white placeholder:text-[#9481AA]/70 rounded-lg px-4 py-3 border border-transparent focus:border-[#6D35FF] focus:outline-none focus:ring-2 focus:ring-[#6D35FF]/50 transition-all"
            autoFocus
          />
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
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? 'Applying...' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromptModal;
