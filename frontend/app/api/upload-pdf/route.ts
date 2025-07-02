import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData()
    
    // Default to localhost:8000 for the FastAPI backend
    const apiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'
    
    // Forward the form data to FastAPI
    const response = await fetch(`${apiUrl}/api/upload-pdf`, {
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