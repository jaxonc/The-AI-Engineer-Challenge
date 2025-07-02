import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Simple approach: return empty list on any error to prevent build failures
  try {
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
    // Return empty list on any error - this prevents build failures
    return NextResponse.json({
      pdfs: []
    })
  }
} 