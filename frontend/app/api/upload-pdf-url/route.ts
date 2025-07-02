import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Check if this is being called during build time
    if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
      // During build, just return a success response
      return NextResponse.json({ 
        pdf_id: 'build_time',
        filename: 'build_time.pdf',
        source: 'url',
        url: 'build_time_url',
        num_chunks: 0,
        message: 'Build time response'
      });
    }

    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/upload-pdf-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || 'Failed to upload PDF from URL' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Upload PDF URL error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 