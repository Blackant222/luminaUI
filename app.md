# Lumina AI - Application Overview

This document provides an overview of the Lumina AI application's architecture, its current state, and a roadmap for transforming it into a production-ready, full-stack application.

## 1. Current Architecture

Lumina AI is currently a **purely client-side single-page application (SPA)** built with modern web technologies.

-   **Framework:** [React](https://react.dev/) with TypeScript for a robust, type-safe, and component-based UI.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) is used for a utility-first approach to styling, enabling rapid development of the custom, glassmorphic design language.
-   **State Management:** The application employs a centralized state management pattern using a custom React `useReducer` hook (`useCanvasReducer`). This architecture is inspired by Redux and ensures that all state mutations are handled as atomic, predictable actions. This is crucial for managing the complex state of the canvas and providing reliable undo/redo functionality.
-   **AI Integration:** All AI-powered features are handled by a dedicated service module (`services/geminiService.ts`). This module encapsulates all API calls to the **Google Gemini API** using the `@google/genai` library, cleanly separating the AI logic from the UI components.
-   **Execution Environment:** The application runs entirely in the user's web browser. It uses ES modules and an `importmap` in `index.html` to load dependencies directly from a CDN, simplifying the development setup without requiring a local bundler like Vite or Webpack.

## 2. Is this a full-stack app?

**No.** In its current form, Lumina AI is **not a full-stack application**. It is a client-side application that communicates directly with an external third-party API (Google Gemini).

It lacks its own dedicated backend server and database. Key features of a full-stack application that are currently missing include:

-   User Authentication (the current login screen is a mock).
-   User Data Persistence (all created work is lost on page refresh).
-   Secure API Key Management.

## 3. How to Make it Production-Ready (Without a Frontend Rewrite)

To transition Lumina AI from a client-side prototype to a secure, scalable, and production-ready full-stack application, you must introduce a backend layer. The key principle is to **never expose your Google Gemini API key on the client-side**. A **Backend Proxy** architecture is the ideal solution to achieve this without rewriting the existing frontend code.

Using a Backend-as-a-Service (BaaS) like **Supabase** is highly recommended as it provides all the necessary tools (Database, Auth, Storage, and Edge Functions for the proxy) in one platform.

### Step 1: Create a Secure Backend Proxy

The most critical security change is to **stop calling the Google Gemini API from the browser**.

-   **The Problem:** The current `geminiService.ts` uses an API key directly on the client. Anyone can open the browser's developer tools, find this key, and use it for their own purposes, leading to massive unexpected bills.
-   **The Solution: A Backend Proxy.** Your frontend will no longer call Google directly. Instead, it will call your own backend API endpoints. This backend will be the only part of your system that knows the secret API key.

**Example using a Supabase Edge Function (or Vercel/Netlify Function):**

1.  **Create a new Edge Function** called `generate-image`.
2.  **Store your `GOOGLE_API_KEY`** as a secret environment variable in your Supabase project settings.
3.  **Write the Function Logic (TypeScript):**
    ```typescript
    // supabase/functions/generate-image/index.ts
    import { GoogleGenAI } from "@google/genai";

    Deno.serve(async (req) => {
      // 1. Get the prompt from the client's request
      const { prompt } = await req.json();

      // 2. Initialize the AI SDK securely with the secret key
      const ai = new GoogleGenAI({ apiKey: Deno.env.get("GOOGLE_API_KEY") });

      // 3. Call the actual Google Gemini API from your backend
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
      });

      // 4. Return the result back to the client
      const base64Image = response.generatedImages[0].image.imageBytes;
      return new Response(JSON.stringify({ image: `data:image/png;base64,${base64Image}` }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    ```
4.  **Update the Frontend Service (`services/geminiService.ts`):**
    The only change required on the frontend is to modify the service function to call your new proxy endpoint instead of the Google SDK.

    **Before:**
    ```typescript
    // Calls Google directly (INSECURE)
    export const generateImage = async (prompt: string): Promise<string> => {
      const response = await ai.models.generateImages(...);
      return `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
    };
    ```
    **After:**
    ```typescript
    // Calls your secure backend proxy (SECURE)
    import { createClient } from '@supabase/supabase-js';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    export const generateImage = async (prompt: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt },
      });
      if (error) throw error;
      return data.image;
    };
    ```

You would repeat this proxy pattern for every AI function (`editImage`, `mergeImages`, etc.).

### Step 2: Implement Real Authentication & Data Persistence

With a backend in place, you can now add user accounts and save their work.

1.  **Implement Real Authentication:** Replace the mock login screen with [Supabase Auth](https://supabase.com/docs/guides/auth). This is straightforward and provides email/password, Google OAuth, and secure session management.
2.  **Database Schema:** Use Supabase's PostgreSQL database.
    -   **`projects` Table:** Stores project metadata (`id`, `user_id`, `name`, `last_updated`).
    -   **`elements` Table:** Stores each canvas element (`id`, `project_id`, `type`, `properties` as JSONB). This allows for saving and loading the complete canvas state.
3.  **Row Level Security (RLS):** Enable RLS on your tables to ensure users can **only** access and modify their own projects. Supabase makes this easy to configure.
4.  **Image Storage:** Storing images as base64 strings in the database is inefficient.
    -   **Solution:** Use [Supabase Storage](https://supabase.com/docs/guides/storage). When a user uploads or generates an image, save it to a secure bucket in Supabase Storage. Store the resulting URL in your `elements` table instead of the full base64 data.

By following this roadmap, Lumina AI can evolve from an impressive client-side demonstration into a secure, robust, and commercially viable full-stack web application.