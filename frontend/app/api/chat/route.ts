import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Default to localhost:8000 for the FastAPI backend
    const apiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'
    
    const response = await fetch(`${apiUrl}/api/chat`, {
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
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to FastAPI backend' },
      { status: 500 }
    )
  }
} 