generate-image

https://vhagzeyokwwjheljzwfw.supabase.co/functions/v1/generate-image


// index.ts — Supabase Edge Function (Deno)
// @ts-ignore
import { GoogleGenAI } from "https://esm.sh/@google/genai@0.15.0";
// Get API key
const apiKey = Deno.env.get("GOOGLE_API_KEY");
if (!apiKey) throw new Error("FATAL: GOOGLE_API_KEY not set!");
const ai = new GoogleGenAI({
  apiKey
});
// Utility: determines "safe" config for region
function getPersonConfig(regionHint) {
  // EU/UK/CH/MENA → no allow_all support
  const restrictedRegions = [
    "eu",
    "uk",
    "ch",
    "mena",
    "me",
    "ae",
    "sa",
    "ma",
    "dz",
    "tn",
    "tr"
  ];
  const guess = (regionHint || "").toLowerCase();
  if (!guess || restrictedRegions.some((r)=>guess.includes(r))) {
    return {}; // remove personGeneration entirely
  }
  // If not restricted, you may still safely use allow_all
  return {
    personGeneration: "allow_all"
  };
}
async function generateImage(prompt, regionHint) {
  console.log(`Generating image for: "${prompt}"`);
  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config: {
      numberOfImages: 1,
      sampleImageSize: "1K",
      aspectRatio: "1:1",
      ...getPersonConfig(regionHint)
    }
  });
  if (!response.generatedImages?.length) {
    throw new Error("API returned no images.");
  }
  const imgBytes = response.generatedImages[0].image.imageBytes;
  return `data:image/png;base64,${imgBytes}`;
}
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info"
      }
    });
  }
  try {
    const { prompt, region } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({
        success: false,
        error: "Prompt is required"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const image = await generateImage(prompt, region);
    return new Response(JSON.stringify({
      success: true,
      image
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    console.error("Error in generate-image:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});



21 hours ago

14

merge-images

https://vhagzeyokwwjheljzwfw.supabase.co/functions/v1/merge-images

// index.ts — Supabase Edge Function (Deno)
// @ts-ignore
import { GoogleGenAI } from "https://esm.sh/@google/genai@0.15.0";
// Init SDK with API key from environment
const apiKey = Deno.env.get("GOOGLE_API_KEY");
if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
const ai = new GoogleGenAI({
  apiKey
});
Deno.serve(async (req)=>{
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info"
      }
    });
  }
  try {
    const { prompt, images } = await req.json();
    if (!prompt && (!images || !images.length)) {
      return new Response(JSON.stringify({
        success: false,
        error: "You must supply at least a prompt or an image"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // Build contents array according to Gemini docs
    const contents = [];
    if (prompt) contents.push({
      text: prompt
    });
    if (images && Array.isArray(images)) {
      for (const img of images){
        contents.push({
          inlineData: {
            mimeType: "image/png",
            data: img.includes(",") ? img.split(",")[1] : img
          }
        });
      }
    }
    // Call Gemini image model
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents
    });
    // Extract image or text
    let imageBase64 = "";
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts){
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        break;
      }
    }
    if (imageBase64) {
      return new Response(JSON.stringify({
        success: true,
        image: `data:image/png;base64,${imageBase64}`
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // If no image, maybe text response
    const textResponse = parts.map((p)=>p.text).filter(Boolean).join("\n");
    return new Response(JSON.stringify({
      success: true,
      response: textResponse || null
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Unknown error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});



21 hours ago

3

edit-image

https://vhagzeyokwwjheljzwfw.supabase.co/functions/v1/edit-image

// index.ts – Supabase Edge Function (Deno) for editing images with Gemini
// @ts-ignore
import { GoogleGenAI } from "https://esm.sh/@google/genai@0.15.0";
// Init AI client
const apiKey = Deno.env.get("GOOGLE_API_KEY");
if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
const ai = new GoogleGenAI({
  apiKey
});
Deno.serve(async (req)=>{
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info"
      }
    });
  }
  try {
    const { image, mask, prompt } = await req.json();
    if (!prompt || !image) {
      return new Response(JSON.stringify({
        success: false,
        error: "At least 'prompt' and 'image' are required"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // Build contents array (in Gemini’s latest structure)
    const contents = [
      {
        text: prompt
      }
    ];
    // Main image
    contents.push({
      inlineData: {
        mimeType: "image/png",
        data: image.includes(",") ? image.split(",")[1] : image
      }
    });
    // Optional mask image
    if (mask) {
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: mask.includes(",") ? mask.split(",")[1] : mask
        }
      });
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents
    });
    // Extract first returned image (if any)
    let base64Image = "";
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts){
      if (part.inlineData?.data) {
        base64Image = part.inlineData.data;
        break;
      }
    }
    if (!base64Image) {
      // Return text output if no image
      const textOut = parts.map((p)=>p.text).filter(Boolean).join("\n");
      return new Response(JSON.stringify({
        success: true,
        response: textOut || null
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // Return the generated image
    return new Response(JSON.stringify({
      success: true,
      image: `data:image/png;base64,${base64Image}`
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Error in edit-image function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Unknown error occurred"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});


21 hours ago

3

expand-image

https://vhagzeyokwwjheljzwfw.supabase.co/functions/v1/expand-image


// index.ts – Expand image with Gemini 2.5 Flash Image Preview
// @ts-ignore
import { GoogleGenAI } from "https://esm.sh/@google/genai@0.15.0";
const apiKey = Deno.env.get("GOOGLE_API_KEY");
if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
const ai = new GoogleGenAI({
  apiKey
});
Deno.serve(async (req)=>{
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info"
      }
    });
  }
  try {
    const { image, newDimensions } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({
        success: false,
        error: "Image is required"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // Base prompt for expansion
    let prompt = "Fill in the transparent areas, continuing the existing image realistically. " + "Expand the background and complete any objects that are cut off.";
    if (newDimensions) {
      prompt += ` Target approximate size: ${newDimensions.width}x${newDimensions.height} pixels.`;
    }
    // Build content array for Gemini request
    const contents = [
      {
        text: prompt
      },
      {
        inlineData: {
          mimeType: "image/png",
          data: image.includes(",") ? image.split(",")[1] : image
        }
      }
    ];
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents
    });
    // Find first image in response
    let imageBase64 = "";
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts){
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        break;
      }
    }
    if (!imageBase64) {
      const textOut = parts.map((p)=>p.text).filter(Boolean).join("\n");
      return new Response(JSON.stringify({
        success: true,
        response: textOut || null
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      image: `data:image/png;base64,${imageBase64}`
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Error in expand-image function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Unknown error occurred"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});


21 hours ago

3

upload-auto-styled-product-photos

https://vhagzeyokwwjheljzwfw.supabase.co/functions/v1/upload-auto-styled-product-photos



4 hours ago

1

// index.ts – Supabase Edge Function (Deno) for Auto-Styling Product Photos with Gemini
// @ts-ignore
import { GoogleGenAI } from "https://esm.sh/@google/genai@0.15.0";
// --- Initialize the Google GenAI Client ---
// It's crucial to set your GOOGLE_API_KEY in your Supabase project's environment variables.
const apiKey = Deno.env.get("GOOGLE_API_KEY");
if (!apiKey) {
  console.error("GOOGLE_API_KEY environment variable not set.");
  throw new Error("GOOGLE_API_KEY not set");
}
const ai = new GoogleGenAI(apiKey);
Deno.serve(async (req)=>{
  // --- Handle CORS Preflight Request ---
  // This is essential for allowing your web application to call this function from the browser.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info"
      }
    });
  }
  try {
    // --- Parse Incoming Request ---
    // The function expects a JSON body with the product image and an optional user prompt.
    const { image, prompt: userPrompt } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({
        success: false,
        error: "'image' is a required field."
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // --- Master Prompt for Auto-Styling ---
    // This detailed prompt guides the AI to create a high-quality product shot.
    const masterPrompt = `
      Transform the provided user-uploaded product image into a professional, visually stunning product photograph.
      The output should be a high-resolution, beautifully lit image with a clean, elegant, and non-distracting background that makes the product the hero.
      It should look like a professional studio shot. Enhance the lighting, composition, and overall aesthetic to create a 'wow' factor.
      The final image must be photorealistic and compelling, suitable for an e-commerce website or a high-end marketing campaign.
    `;
    // --- Combine Master and User Prompts ---
    // If the user provides their own instructions, they are appended for more customized results.
    const fullPrompt = userPrompt ? `${masterPrompt}\n\nUser's specific instructions: "${userPrompt}"` : masterPrompt;
    // --- Construct the Payload for the Gemini API ---
    // This follows the latest structure required by the Gemini models.
    const contents = [
      {
        text: fullPrompt
      },
      {
        inlineData: {
          mimeType: "image/png",
          // Cleans up the base64 string if it includes a data URL prefix.
          data: image.includes(",") ? image.split(",")[1] : image
        }
      }
    ];
    // --- Call the Gemini Model ---
    const response = await ai.getGenerativeModel({
      model: "gemini-2.5-flash-image-preview"
    }).generateContent({
      contents
    });
    // --- Extract the Generated Image from the Response ---
    let base64Image = "";
    const parts = response.response.candidates?.[0]?.content?.parts || [];
    for (const part of parts){
      if (part.inlineData?.data) {
        base64Image = part.inlineData.data;
        break;
      }
    }
    // --- Handle Text-Only Response ---
    // If the model doesn't return an image, return its text response instead.
    if (!base64Image) {
      const textOut = parts.map((p)=>p.text).filter(Boolean).join("\n");
      return new Response(JSON.stringify({
        success: true,
        response: textOut || "No image was generated, and no text response was provided."
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    // --- Return the Final Generated Image ---
    return new Response(JSON.stringify({
      success: true,
      image: `data:image/png;base64,${base64Image}`
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    // --- General Error Handling ---
    console.error("Error in upload-auto-styled-product-photos function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "An unknown error occurred."
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
