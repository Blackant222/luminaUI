# Lumina AI - Application Overview

Lumina AI is a powerful, browser-based creative suite that combines intuitive design tools with cutting-edge AI capabilities. It allows users to create, edit, and manipulate visual content using both traditional design tools and AI-powered features.

## Core Features & Functions

### 1. Design Tools
- **Selection Tool**: Select and manipulate elements on the canvas
- **Hand Tool**: Pan around the canvas for easy navigation
- **Frame Tool**: Create containers for organizing content
- **Brush Tool**: Draw freehand on images with AI-powered editing
- **Pen Tool**: Create precise vector paths and shapes
- **Text Tool**: Add and edit text elements with full formatting controls
- **Shape Tools**: Create rectangles, ellipses, lines, arrows, polygons, and stars
- **Generate Tool**: Create new images from text prompts using AI
- **Merge Tool**: Combine multiple images with AI assistance
- **Upload Tool**: Import images from your device

### 2. AI-Powered Features
- **Text-to-Image Generation**: Create entirely new images from text descriptions
- **Image Editing with Mask**: Edit specific areas of an image using brush strokes and text prompts
- **Global Image Editing**: Modify entire images using natural language descriptions
- **Image Expansion**: Extend images beyond their original boundaries with AI-generated content
- **Image Merging**: Combine multiple images into a single cohesive composition

### 3. Canvas & Editing
- **Multi-layer Support**: Organize elements in a hierarchical layer structure
- **Element Manipulation**: Move, resize, rotate, and transform any element
- **Layer Management**: Control visibility, ordering, and grouping of elements
- **Undo/Redo**: Comprehensive history management for all actions
- **Context Menu**: Right-click access to element-specific actions
- **Keyboard Shortcuts**: Efficient workflow with hotkeys for all major tools

### 4. Project Management
- **Dashboard**: Central hub for accessing and managing projects
- **Project Gallery**: View all saved projects with thumbnail previews
- **Save/Load**: Persistent storage of projects with full state restoration
- **Export**: Save your creations for use in other applications

## Technical Architecture

### Frontend Stack
- **React 19**: Modern component-based UI framework
- **TypeScript**: Strong typing for improved code quality and maintainability
- **Tailwind CSS**: Utility-first styling for rapid UI development
- **Lucide React**: Consistent iconography throughout the application
- **Vite**: Fast build tool and development server

### State Management
- **Custom Reducer Pattern**: Centralized state management with predictable updates
- **History Tracking**: Built-in undo/redo functionality
- **Context API**: Global state sharing for user authentication and project data

### AI Integration
- **Google Gemini API**: Backend for all AI-powered features
- **Supabase Edge Functions**: Secure proxy for API calls
- **Service Layer**: Clean separation of AI logic from UI components

## HTML5 Canvas vs. Current Implementation

### Current Implementation (DOM-based)
Lumina AI currently uses a DOM-based approach where each canvas element is represented as a separate HTML element (div, img, svg, etc.). This approach has several advantages:

**Pros:**
- **Accessibility**: Native browser accessibility features work out of the box
- **SEO**: Content is indexable by search engines
- **Inspectability**: Easy debugging with browser developer tools
- **CSS Flexibility**: Full power of CSS for styling and animations
- **Responsive Design**: Natural integration with responsive layouts
- **Event Handling**: Direct DOM event handling for each element

**Cons:**
- **Performance**: Can become slow with many elements or complex scenes
- **Memory Usage**: Higher memory consumption with many DOM nodes
- **Rendering**: Not ideal for pixel-perfect graphics or complex animations

### HTML5 Canvas Option

Switching to HTML5 Canvas would involve rendering the entire canvas as a single bitmap. This approach has different trade-offs:

**Pros:**
- **Performance**: Much better performance with large numbers of elements
- **Memory Efficiency**: Lower memory usage for complex scenes
- **Pixel Control**: Perfect for pixel-level manipulations and effects
- **Consistent Rendering**: Identical appearance across all browsers
- **Export Simplicity**: Easy to export as image files

**Cons:**
- **Accessibility**: Loss of native accessibility features
- **SEO**: Content becomes invisible to search engines
- **Interactivity**: More complex to implement element-level interactions
- **Text Rendering**: Lower quality text compared to DOM rendering
- **Responsiveness**: More complex to implement responsive layouts
- **Development Complexity**: Significantly more complex implementation

### Recommendation

For Lumina AI, the **current DOM-based approach is the better choice** for the following reasons:

1. **Design Tool Requirements**: Design applications benefit more from the accessibility and inspectability of DOM elements
2. **Interactivity Needs**: The application requires complex element-level interactions that are easier with DOM
3. **Text Quality**: High-quality text rendering is important for design work
4. **Development Speed**: Faster development and iteration with DOM-based approach
5. **Debugging**: Easier debugging and troubleshooting with browser tools

HTML5 Canvas would only be beneficial if:
- You plan to support hundreds or thousands of elements simultaneously
- You need complex pixel-level effects not possible with CSS
- Performance becomes a critical issue with the current implementation

For most design applications, the benefits of DOM-based rendering outweigh the performance advantages of HTML5 Canvas.