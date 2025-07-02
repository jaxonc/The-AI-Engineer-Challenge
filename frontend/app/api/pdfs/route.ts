import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Detect if we're in build/export mode and return empty response
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
      // During build/export, return empty list
      return NextResponse.json({
        pdfs: []
      })
    }
    
    // Construct full URL for server-side fetch in Vercel
    let apiUrl: string;
    
    if (process.env.NODE_ENV === 'production') {
      // In Vercel, use the deployment URL
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : request.url.split('/api/')[0]; // Fallback to current domain
      apiUrl = `${baseUrl}/api/pdfs`;
    } else {
      // Local development
      apiUrl = process.env.FASTAPI_URL || 'http://localhost:8000/api/pdfs';
    }
    
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
    // During build/export, return empty list instead of error
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
      return NextResponse.json({
        pdfs: []
      })
    }
    return NextResponse.json(
      { error: 'Failed to fetch PDFs from backend' },
      { status: 500 }
    )
  }
} 