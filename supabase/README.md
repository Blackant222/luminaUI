# Lumina AI - Supabase Integration

This directory contains all the Supabase integration files for Lumina AI, including database schema and edge functions.

## Directory Structure

- `schema.sql` - Database schema for projects and user data
- `functions/` - Supabase Edge Functions for secure AI operations
  - `generate-image/` - Text-to-image generation
  - `edit-image/` - Image editing (with/without mask)
  - `merge-images/` - Merging multiple images
  - `expand-image/` - Image expansion/outpainting

## Setup Instructions

### 1. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the `schema.sql` file to create the necessary tables

### 2. Edge Functions Deployment

#### Option A: Using Supabase CLI (Recommended)

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to your Supabase account:
   ```bash
   supabase login
   ```

3. Set your Google API key as a secret:
   ```bash
   supabase secrets set GOOGLE_API_KEY=your_actual_google_api_key_here
   ```

4. Deploy all functions:
   ```bash
   supabase functions deploy generate-image --project-ref vhagzeyokwwjheljzwfw
   supabase functions deploy edit-image --project-ref vhagzeyokwwjheljzwfw
   supabase functions deploy merge-images --project-ref vhagzeyokwwjheljzwfw
   supabase functions deploy expand-image --project-ref vhagzeyokwwjheljzwfw
   ```

#### Option B: Manual Deployment via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to "Edge Functions" in the left sidebar
3. Click "Create Function" for each function:
   - `generate-image`
   - `edit-image`
   - `merge-images`
   - `expand-image`
4. Copy the code from each function's index.ts file
5. Set the function name to match the directory name
6. Deploy each function

## Security

The Google API key is stored securely as a Supabase secret and accessed through:
```javascript
Deno.env.get("GOOGLE_API_KEY")
```

This ensures that your API key is never exposed to the frontend or stored in your code repository.

## Authentication

Email authentication is enabled by default. To configure:
1. Go to Authentication > Providers in your Supabase dashboard
2. Enable the Email provider
3. Configure any additional settings as needed