import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ensure the images directory exists
const imagesDir = path.join(process.cwd(), "public", "character-images");
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const { character_name, character_description, character_traits } = await request.json();

    if (!character_name || !character_description) {
      return NextResponse.json(
        { success: false, error: "Character name and description are required" },
        { status: 400 }
      );
    }

    // Create a detailed prompt for character image generation
    const traits_str = Array.isArray(character_traits) ? character_traits.join(", ") : "friendly";
    const prompt = `Create a children's book style illustration of a character named ${character_name}. 

Character details:
- Name: ${character_name}
- Description: ${character_description}
- Traits: ${traits_str}

Style requirements:
- Children's book illustration style
- Colorful and friendly
- Age-appropriate for kids (5-10 years old)
- Cartoon/animated style, not realistic
- Character should be the main focus
- Clean, simple background
- High quality, detailed but not complex`;

    // Generate image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No image data returned from DALL-E");
    }

    const image_url = response.data[0].url;
    
    if (!image_url) {
      throw new Error("No image URL returned from DALL-E");
    }
    
    // Download the image and save it locally
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageData = Buffer.from(imageBuffer);
    
    // Create a unique filename
    const timestamp = Date.now();
    const safeName = character_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `${safeName}_${timestamp}.png`;
    const filepath = path.join(imagesDir, filename);
    
    // Save the image locally
    fs.writeFileSync(filepath, imageData);
    
    // Return the local path that can be served by Next.js
    const localImageUrl = `/character-images/${filename}`;

    return NextResponse.json({
      success: true,
      image_url: localImageUrl,
      character_name: character_name,
      local_path: filepath,
    });

  } catch (error) {
    console.error("Error generating character image:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to generate character image" 
      },
      { status: 500 }
    );
  }
}
