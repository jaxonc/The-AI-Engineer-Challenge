import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Default to localhost:8000 for the FastAPI backend
    const apiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'
    
    const response = await fetch(`${apiUrl}/api/pdfs`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`FastAPI error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PDF List API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch PDFs from backend' },
      { status: 500 }
    )
  }
} 