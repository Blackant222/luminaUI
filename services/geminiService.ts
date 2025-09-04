import { createClient } from '@supabase/supabase-js';
import { ImageElement } from '../types';

// Initialize Supabase client
const supabase = createClient(
  // @ts-ignore
  import.meta.env.VITE_SUPABASE_URL,
  // @ts-ignore
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const urlToBlob = async (url: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return blob;
};

export const urlToBase64 = async (url: string): Promise<{mimeType: string, data: string}> => {
  const blob = await urlToBlob(url);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
      resolve({ mimeType, data });
    };
    reader.onerror = error => reject(error);
  });
};

export const generateImage = async (prompt: string): Promise<string> => {
  console.log(`Generating image for prompt: "${prompt}"`);
  
  try {
    console.log("Calling generate-image function with prompt:", prompt);
    const { data, error } = await supabase.functions.invoke('generate-image', {
      body: { prompt },
    });
    console.log("Function response - data:", data, "error:", error);

    if (error) throw error;
    if (!data.success) throw new Error(data.error || "Failed to generate image");

    return data.image || data.response;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const editImageWithMask = async (
  base64ImageData: string,
  base64MaskData: string,
  prompt: string
): Promise<string> => {
  console.log(`Editing image with mask and prompt: "${prompt}"`);
  
  try {
    console.log("Calling edit-image function with image, mask, and prompt");
    const { data, error } = await supabase.functions.invoke('edit-image', {
      body: { 
        image: base64ImageData,
        mask: base64MaskData,
        prompt 
      },
    });
    console.log("Function response - data:", data, "error:", error);

    if (error) throw error;
    if (!data.success) throw new Error(data.error || "Failed to edit image");

    return data.image || data.response;
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};

export const editImageGlobally = async (
  base64ImageData: string,
  prompt: string
): Promise<string> => {
  console.log(`Editing image globally with prompt: "${prompt}"`);
  
  try {
    console.log("Calling edit-image function with image and prompt");
    const { data, error } = await supabase.functions.invoke('edit-image', {
      body: { 
        image: base64ImageData,
        prompt 
      },
    });
    console.log("Function response - data:", data, "error:", error);

    if (error) throw error;
    if (!data.success) throw new Error(data.error || "Failed to edit image");

    return data.image || data.response;
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};

export const editImageWithTextPrompt = editImageGlobally;

export const expandImage = async (
  originalElement: ImageElement,
  newDimensions: { width: number; height: number }
): Promise<string> => {
  console.log(`Expanding image to new dimensions: ${newDimensions.width}x${newDimensions.height}`);

  const canvas = document.createElement('canvas');
  canvas.width = newDimensions.width;
  canvas.height = newDimensions.height;
  const ctx = canvas.getContext('2d')!;

  const img = new Image();
  img.crossOrigin = "anonymous";
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = originalElement.src;
  });

  const newX = originalElement.x - (newDimensions.width - originalElement.width) / 2;
  const newY = originalElement.y - (newDimensions.height - originalElement.height) / 2;
  
  const drawX = (newDimensions.width - originalElement.width) / 2;
  const drawY = (newDimensions.height - originalElement.height) / 2;

  ctx.drawImage(img, drawX, drawY, originalElement.width, originalElement.height);
  
  const compositeImageB64 = canvas.toDataURL('image/png');

  try {
    console.log("Calling expand-image function with image and dimensions");
    const { data, error } = await supabase.functions.invoke('expand-image', {
      body: { 
        image: compositeImageB64,
        newDimensions
      },
    });
    console.log("Function response - data:", data, "error:", error);

    if (error) throw error;
    if (!data.success) throw new Error(data.error || "Failed to expand image");

    return data.image || data.response;
  } catch (error) {
    console.error("Error expanding image:", error);
    throw error;
  }
};

export const mergeImages = async (
  imageUrls: string[],
  prompt: string
): Promise<string> => {
  console.log(`Merging ${imageUrls.length} images with prompt: "${prompt}"`);

  try {
    console.log("Calling merge-images function with images and prompt");
    const { data, error } = await supabase.functions.invoke('merge-images', {
      body: { 
        images: imageUrls,
        prompt 
      },
    });
    console.log("Function response - data:", data, "error:", error);

    if (error) throw error;
    if (!data.success) throw new Error(data.error || "Failed to merge images");

    return data.image || data.response;
  } catch (error) {
    console.error("Error merging images:", error);
    throw error;
  }
};