# Lumina AI - Current Application Overview

This document provides a comprehensive overview of the Lumina AI application's architecture, technology stack, project structure, and API integration strategy.

## 1. Technology Stack

Lumina AI is a modern, purely client-side single-page application (SPA) built with a focus on performance, type safety, and a professional user experience.

-   **Core Framework:** [React](https://react.dev/) (v19) with TypeScript. This provides a robust, component-based architecture with strong type safety to minimize runtime errors.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/). A utility-first CSS framework is used for rapid development of the custom, glassmorphic design system.
-   **Icons:** [Lucide React](https://lucide.dev/). A clean, consistent, and highly customizable SVG icon library.
-   **AI Services:** [Google Gemini API](https://ai.google.dev/) via the `@google/genai` SDK. This is the core engine for all intelligent features, including image generation, editing, and analysis.
-   **Build System:** The project leverages modern browser capabilities, using an `importmap` in `index.html` to load ES modules directly from a CDN. This allows for a buildless development environment, simplifying the setup process.

## 2. Application Architecture

The application is architected around a centralized, predictable state management pattern, which is essential for a complex, interactive editor.

-   **State Management:** The core of the application's logic resides in a custom React hook, `useCanvasReducer`. This hook implements the **Reducer pattern**, which is heavily inspired by Flux and Redux.
    -   **Single Source of Truth:** All canvas state (elements, selections, etc.) is stored in a single object.
    -   **State is Read-Only:** The state cannot be changed directly.
    -   **Changes are Made with Pure Functions:** To change the state, you must dispatch an `action`. An action is a plain object describing what happened. The `canvasReducer` function takes the current state and an action and returns the *new* state.
    -   This pattern makes the application's behavior predictable and easy to debug. It also provides a perfect foundation for features like undo/redo.
-   **Undo/Redo History:** The `useCanvasReducer` hook is wrapped in a higher-order reducer that automatically manages a history of past states. Every action (except for transient updates like mouse movements) creates a new entry in the history stack, allowing for reliable undo and redo functionality.
-   **Component Structure:** The application is broken down into logical components.
    -   `App.tsx` acts as the main router, controlling which view (Dashboard, Editor, etc.) is visible.
    -   `EditorScreen.tsx` is the container for the main editor experience.
    -   `Canvas.tsx` is the most complex component, responsible for rendering all elements and handling all user interactions (mouse events, keyboard shortcuts, drag-and-drop).
    -   UI elements like `Toolbar.tsx`, `LayersPanel.tsx`, and `ContextMenu.tsx` are kept as separate, reusable components.

## 3. Project Structure

The project is organized logically to separate concerns and improve maintainability.

```
/
├── public/
│   └── (Static assets, not currently used)
├── src/
│   ├── components/
│   │   ├── AuthScreen.tsx
│   │   ├── Canvas.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── EditorScreen.tsx
│   │   ├── ... (Other UI components)
│   ├── hooks/
│   │   └── useCanvasReducer.ts   # Core state management logic
│   ├── services/
│   │   └── geminiService.ts      # All Google Gemini API calls
│   ├── App.tsx                   # Main application router
│   ├── constants.tsx             # App-wide constants (e.g., tool definitions)
│   ├── index.tsx                 # React application entry point
│   └── types.ts                  # Centralized TypeScript types and interfaces
├── .gitignore
├── index.html                    # The single HTML page
├── metadata.json
├── package.json
└── tsconfig.json
```

## 4. API Integration

All communication with the Google Gemini API is encapsulated within the `services/geminiService.ts` module. This is a critical architectural decision that keeps the API logic separate from the UI.

-   **Encapsulation:** Components do not know how the AI works. They simply call functions from the `geminiService` (e.g., `generateImage(prompt)`). The service handles the details of interacting with the `@google/genai` SDK, constructing the correct request, and parsing the response.
-   **Functions:** The service exports a function for each specific AI task:
    -   `generateImage`: Uses the `imagen-4.0` model for text-to-image generation.
    -   `editImageWithMask`: Uses the `gemini-2.5-flash-image-preview` model for inpainting (the Brush tool).
    -   `editImageGlobally`: Uses the same model for making changes to an entire image (the "Edit with AI" feature).
    -   `expandImage`: A complex function that composites an image onto a larger transparent canvas and uses the AI for outpainting.
    -   `mergeImages`: Combines multiple images with a text prompt.
-   **Security Note:** In its current state, the application is a **prototype** and initializes the GenAI SDK directly on the client side. As detailed in `app.md`, for a production environment, this is **highly insecure**. The `geminiService.ts` would need to be modified to call a secure backend proxy instead of the Google API directly.
