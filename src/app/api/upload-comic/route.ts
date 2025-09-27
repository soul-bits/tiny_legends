import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
      return NextResponse.json({ error: 'Only PDF and text files are supported' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save file to uploads directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileExtension = file.type === 'application/pdf' ? 'pdf' : 'txt';
    const fileName = `comic-${Date.now()}.${fileExtension}`;
    const filePath = join(uploadsDir, fileName);
    
    await writeFile(filePath, buffer);

    // Return success response - character extraction will be handled by the agent
    // The agent can use the process_uploaded_comic tool to extract characters
    return NextResponse.json({ 
      success: true, 
      fileName,
      filePath: filePath,
      message: "Comic uploaded successfully. You can now ask the agent to process it and extract characters."
    });

  } catch (error) {
    console.error('Error processing comic upload:', error);
    return NextResponse.json(
      { error: 'Failed to process comic file' }, 
      { status: 500 }
    );
  }
}
