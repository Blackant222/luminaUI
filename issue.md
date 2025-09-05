# Lumia AI Application Issues

## Overview
This document outlines the key issues encountered with the Lumia AI application, specifically related to tool functionality and UI behavior. These issues were affecting the user experience and preventing proper interaction with the canvas elements.

## Issues

### 1. Non-sticky Prompt Boxes
**Problem**: The AI prompt boxes for editing images and generated images were not sticky and would not remain visible when scrolling or navigating the canvas.

**Symptoms**:
- Prompt boxes would disappear when scrolling
- Prompt boxes were positioned absolutely rather than fixed
- Inconsistent behavior compared to the side tool panel which remained visible

### 2. Image Resizing with Pointer Tool
**Problem**: Images on the canvas could not be resized using the pointer/selection tool.

**Symptoms**:
- No resize handles visible on selected image elements
- Unable to interact with edges/corners of images to change their dimensions
- Missing resize functionality that should be available for all canvas elements

### 3. Brush Tool Not Working
**Problem**: The brush tool was not functioning properly to enable editing of images.

**Symptoms**:
- Brush tool could be selected but did not provide expected functionality
- No prompt bar appearing when trying to use the brush tool
- Brush interactions were not triggering the AI edit prompt as intended

### 4. Tool Import Issues
**Problem**: Incorrect component imports were causing tools to not function properly.

**Symptoms**:
- Tools appeared to be available but did not respond to user interactions
- Console errors related to missing or incorrect component references
- Generate function worked but other tools did not

### 5. Pan/Hand Tool Coordinate Issues
**Problem**: The pan/hand tool was not calculating coordinates correctly, causing improper canvas navigation.

**Symptoms**:
- Canvas would jump or move unexpectedly when panning
- Incorrect mapping between screen coordinates and canvas coordinates
- Jittery or non-smooth panning experience

### 6. Frame, Pen, and Text Tool Requirements
**Problem**: Several tools (frame, pen, text) had incorrect requirements that prevented them from functioning.

**Symptoms**:
- Tools would not activate or create elements
- Error messages about missing frame context
- Inability to create new elements with these tools

## Impact
These issues significantly impacted the usability of the Lumia AI application, preventing users from:
- Properly editing images with the brush tool
- Resizing canvas elements as needed
- Accessing AI prompt functionality consistently
- Navigating the canvas smoothly with the pan tool
- Using essential creation tools (frame, pen, text)

## Additional Observations
- The application is built with React 19, TypeScript, and uses HTML5 Canvas for rendering
- Backend services use Supabase Edge Functions and Google Gemini API
- The UI implements a layered approach with toolbars, canvas, and panels
- Context menus and modals are used for additional functionality