import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData()
    
    // Use relative path for Vercel deployment, fallback to localhost for local dev
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? '/api/upload-pdf'  // Use relative path in production (Vercel)
      : process.env.FASTAPI_URL || 'http://localhost:8000/api/upload-pdf'
    
    // Forward the form data to FastAPI
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`FastAPI error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PDF Upload API Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload PDF to backend' },
      { status: 500 }
    )
  }
} 