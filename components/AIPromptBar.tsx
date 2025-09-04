import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

type AIPromptBarProps = {
  onSubmit: (prompt: string) => void;
  placeholder: string;
  buttonText: string;
  isLoading: boolean;
};

const AIPromptBar: React.FC<AIPromptBarProps> = ({ onSubmit, placeholder, buttonText, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-2 flex items-center gap-2 shadow-lg transition-all duration-300 focus-within:border-white/20"
      >
        <Sparkles className="w-5 h-5 text-[#9481AA] ml-2" />
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-white placeholder:text-[#9481AA]/70 focus:outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="px-4 py-2 bg-[#6D35FF] text-white rounded-lg font-semibold hover:bg-opacity-90 disabled:bg-opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[100px]"
        >
          {isLoading ? 'Generating...' : buttonText}
        </button>
      </form>
    </div>
  );
};

export default AIPromptBar;
