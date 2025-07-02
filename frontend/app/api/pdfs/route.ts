import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Use relative path for Vercel deployment, fallback to localhost for local dev
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? '/api/pdfs'  // Use relative path in production (Vercel)
      : process.env.FASTAPI_URL || 'http://localhost:8000/api/pdfs'
    
    const response = await fetch(apiUrl, {
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