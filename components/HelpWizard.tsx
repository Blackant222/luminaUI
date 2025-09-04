import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

const HelpContent = () => (
    <div className="space-y-6 text-sm text-white/80">
        <div>
            <h3 className="font-semibold text-white mb-2">Core Concepts</h3>
            <p><strong className="text-white/90">Frames (F):</strong> Frames are containers for your designs. You must create a Frame before you can use the Pen or Shape tools. Elements inside a frame move with it.</p>
            <p><strong className="text-white/90">Infinite Canvas:</strong> Pan around by holding the <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Spacebar</kbd> and dragging, or by using the Hand tool (H). Zoom with your mouse wheel.</p>
        </div>

        <div>
            <h3 className="font-semibold text-white mb-2">Tools & Shortcuts</h3>
            <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-white/90">Select (V):</strong> Select, move, and resize elements. Hold <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Shift</kbd> to select multiple.</li>
                <li><strong className="text-white/90">Hand (H):</strong> Click and drag to pan the canvas.</li>
                <li><strong className="text-white/90">Frame (F):</strong> Draw rectangular containers for your vector assets.</li>
                <li><strong className="text-white/90">Brush (B):</strong> Paint over an image to select an area. A prompt bar will appear for you to describe your AI edit. Double-click or press <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Esc</kbd> to exit brush mode.</li>
                <li><strong className="text-white/90">Pen (P):</strong> Click to create points for a vector path inside a frame. Double-click or press <kbd className="px-1.5 py-0.5 bg-white/10 rounded-sm">Esc</kbd> to finalize the path.</li>
                <li><strong className="text-white/90">Shapes (R, O, L):</strong> Create vector rectangles, ellipses, and lines inside frames.</li>
                <li><strong className="text-white/90">Generate (G):</strong> Opens a prompt bar to generate a new image from text.</li>
            </ul>
        </div>
        
        <div>
            <h3 className="font-semibold text-white mb-2">Right-Click Menu</h3>
            <p>Right-click on an element to access quick actions like <strong className="text-white/90">Delete</strong>, <strong className="text-white/90">Duplicate</strong>, and layer ordering. You can also use new AI features:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
                <li><strong className="text-white/90">Edit with AI:</strong> Applies a global change to the entire element (works on vectors too!).</li>
                <li><strong className="text-white/90">Expand Image:</strong> Enters a mode to drag an image's borders outwards to have AI fill in the new space (outpainting).</li>
            </ul>
        </div>
    </div>
);


const HelpWizard: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="absolute bottom-6 right-6 z-20 p-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/20 hover:scale-105 transition-all shadow-lg"
                title="Help"
            >
                <HelpCircle size={24} />
            </button>
            
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setIsOpen(false)}
                >
                    <div 
                        className="w-full max-w-lg bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 flex flex-col gap-6 shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-white">How to use Lumina AI</h2>
                             <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-full text-white/70 hover:bg-white/10"
                             >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto pr-4">
                           <HelpContent />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default HelpWizard;
