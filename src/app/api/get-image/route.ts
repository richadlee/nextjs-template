import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { botToken, photoNumber } = await request.json();
    const imageUrl = `https://api.telegram.org/file/bot${botToken}/photos/file_${photoNumber}.jpg`;
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    return NextResponse.json({
      success: true,
      data: `data:image/jpeg;base64,${base64}`
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch image'
    }, { status: 400 });
  }
} 