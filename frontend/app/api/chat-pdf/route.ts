import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Construct full URL for server-side fetch in Vercel
    let apiUrl: string;
    
    if (process.env.NODE_ENV === 'production') {
      // In Vercel, use the deployment URL
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : request.url.split('/api/')[0]; // Fallback to current domain
      apiUrl = `${baseUrl}/api/chat-pdf`;
    } else {
      // Local development
      apiUrl = process.env.FASTAPI_URL || 'http://localhost:8000/api/chat-pdf';
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`FastAPI error: ${response.status}`)
    }

    // Stream the response from FastAPI to the client
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('PDF Chat API Error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to FastAPI backend' },
      { status: 500 }
    )
  }
} 