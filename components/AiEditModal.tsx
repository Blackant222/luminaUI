
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AiEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  initialPrompt?: string;
}

export const AiEditModal: React.FC<AiEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialPrompt = '',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    onSubmit(prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit with AI</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>
        <textarea
          className="w-full h-32 p-2 border rounded-md mb-4"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the changes you want to make..."
        />
        <div className="flex justify-end">
          {/* Assuming a generic Button component that takes an onClick handler */}
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Generate & Send Image
          </button>
        </div>
      </div>
    </div>
  );
};
