import React from 'react';
import { View } from '../App';
import { ArrowLeft } from 'lucide-react';

const HelpContent = () => (
    <div className="space-y-6 text-sm text-white/80 max-w-2xl mx-auto">
        <div>
            <h3 className="font-semibold text-white text-base mb-2">Core Concepts</h3>
            <p className="mb-1"><strong className="text-white/90">Frames (F):</strong> Frames are containers for your designs. You must create a Frame before you can use the Pen or Shape tools. Elements inside a frame are clipped and move with it.</p>
            <p><strong className="text-white/90">Infinite Canvas:</strong> Pan around by holding the <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Spacebar</kbd> and dragging, or by using the Hand tool (H). Zoom with your mouse wheel.</p>
        </div>

        <div>
            <h3 className="font-semibold text-white text-base mb-2">Tools & Shortcuts</h3>
            <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-white/90">Select (V):</strong> Select, move, and resize elements. Hold <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Shift</kbd> to select multiple.</li>
                <li><strong className="text-white/90">Hand (H):</strong> Click and drag to pan the canvas. Click again to deactivate.</li>
                <li><strong className="text-white/90">Frame (F):</strong> Draw rectangular containers for your vector assets.</li>
                <li><strong className="text-white/90">Brush (B):</strong> Paint over an image to select an area. A prompt bar will appear for you to describe your AI edit. Click again on the canvas or press <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Esc</kbd> to exit brush mode.</li>
                <li><strong className="text-white/90">Pen (P):</strong> Click to create points for a vector path inside a frame. Double-click or press <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Esc</kbd> to finalize the path.</li>
                <li><strong className="text-white/90">Text (T):</strong> Click inside a frame to add text. Double-click existing text to edit it.</li>
                <li><strong className="text-white/90">Shapes (R, O, L):</strong> Create vector rectangles, ellipses, and lines inside frames.</li>
                <li><strong className="text-white/90">Generate (G):</strong> Opens a prompt bar to generate a new image from text.</li>
            </ul>
        </div>
        
        <div>
            <h3 className="font-semibold text-white text-base mb-2">Right-Click Menu</h3>
            <p>Right-click on an element to access quick actions like <strong className="text-white/90">Delete</strong>, <strong className="text-white/90">Duplicate</strong>, and layer ordering. You can also use new AI features:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
                <li><strong className="text-white/90">Edit with AI:</strong> Applies a global change to the entire element (works on vectors too!).</li>
                <li><strong className="text-white/90">Expand Image:</strong> Enters a mode to drag an image's borders outwards to have AI fill in the new space (outpainting).</li>
                <li><strong className="text-white/90">Edit Image with Text:</strong> Select an image AND a text element, then right-click. The text will be used as the AI prompt to edit the image.</li>
            </ul>
        </div>
    </div>
);


type HelpScreenProps = {
  setView: (view: View) => void;
};

const HelpScreen: React.FC<HelpScreenProps> = ({ setView }) => {
  return (
    <div className="w-full h-full p-10 flex flex-col">
       <header className="flex-shrink-0">
         <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-white/70 hover:text-white mb-8">
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
        <h2 className="text-3xl font-bold text-white mb-6">Help & Documentation</h2>
       </header>
       <main className="flex-grow bg-black/10 rounded-2xl p-8 overflow-y-auto border border-white/10">
        <HelpContent />
      </main>
    </div>
  );
};

export default HelpScreen;