'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface ChatRequest {
  developer_message: string
  user_message: string
  model: string
  api_key: string
}

interface PDFChatRequest {
  user_message: string
  pdf_ids: string[]
  model: string
  api_key: string
}

interface UploadedPDF {
  pdf_id: string
  filename: string
  source?: string
  url?: string
  num_chunks: number
  total_characters: number
}

type ChatMode = 'regular' | 'pdf'

export default function Home() {
  const [chatMode, setChatMode] = useState<ChatMode>('regular')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  
  // Regular chat state
  const [regularFormData, setRegularFormData] = useState<ChatRequest>({
    developer_message: '',
    user_message: '',
    model: 'gpt-4o-mini',
    api_key: ''
  })

  // PDF chat state
  const [pdfFormData, setPdfFormData] = useState<PDFChatRequest>({
    user_message: '',
    pdf_ids: [],
    model: 'gpt-4o-mini',
    api_key: ''
  })

  // Multi-PDF selection state
  const [pdfSelectionMode, setPdfSelectionMode] = useState<'single' | 'multiple'>('single')
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([])

  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // PDF upload state
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file')
  const [pdfUrl, setPdfUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch uploaded PDFs on component mount
  const fetchPDFs = async () => {
    try {
      const res = await fetch('/api/pdfs')
      if (res.ok) {
        const data = await res.json()
        setUploadedPDFs(data.pdfs)
      }
    } catch (err) {
      console.error('Failed to fetch PDFs:', err)
    }
  }

  // Initialize PDFs on component mount
  useEffect(() => {
    fetchPDFs()
  }, [])

  // Handle PDF upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!apiKey) {
      setError('Please enter your OpenAI API key first')
      return
    }

    // Client-side file size validation (4.5MB limit - Vercel's hard limit)
    // NOTE: Vercel has a hard 4.5MB request body limit for serverless functions
    // For larger files, consider:
    // 1. Direct client uploads to blob storage (Vercel Blob, AWS S3, etc.)
    // 2. Using a different hosting platform with higher limits
    // 3. Splitting files or using file compression
    const maxFileSize = 4.5 * 1024 * 1024 // 4.5MB in bytes (Vercel's limit)
    if (file.size > maxFileSize) {
      setError('File too large. Please upload a PDF smaller than 4.5MB (Vercel limit).')
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setIsUploading(true)
    setUploadProgress('Uploading PDF...')
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', apiKey)

      setUploadProgress('Processing and indexing PDF...')
      
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let errorMessage = 'Upload failed'
        try {
          // Read response as text first, then try to parse as JSON
          const responseText = await res.text()
          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.detail || errorData.error || 'Upload failed'
          } catch (jsonParseError) {
            // Handle non-JSON responses (e.g., HTML error pages from Vercel)
            if (responseText.includes('Request Entity Too Large') || res.status === 413) {
              errorMessage = 'File too large. Please upload a smaller PDF (max 4.5MB - Vercel limit)'
            } else if (responseText.includes('Bad Request') || res.status === 400) {
              errorMessage = 'Invalid file format. Please upload a valid PDF file'
            } else {
              errorMessage = `Upload failed (${res.status}): ${responseText.substring(0, 100)}...`
            }
          }
        } catch (readError) {
          errorMessage = `Upload failed (${res.status}): Unable to read response`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      setUploadProgress('PDF indexed successfully!')
      
      // Refresh the PDF list
      await fetchPDFs()
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      setTimeout(() => setUploadProgress(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle PDF URL upload
  const handleUrlUpload = async () => {
    if (!pdfUrl.trim()) {
      setError('Please enter a PDF URL')
      return
    }

    if (!apiKey) {
      setError('Please enter your OpenAI API key first')
      return
    }

    setIsUploading(true)
    setUploadProgress('Downloading PDF from URL...')
    setError('')

    try {
      setUploadProgress('Processing and indexing PDF...')
      
      const res = await fetch('/api/upload-pdf-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: pdfUrl,
          api_key: apiKey,
        }),
      })

      if (!res.ok) {
        let errorMessage = 'URL upload failed'
        try {
          // Read response as text first, then try to parse as JSON
          const responseText = await res.text()
          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.error || errorData.detail || 'URL upload failed'
          } catch (jsonParseError) {
            // Handle non-JSON responses (e.g., HTML error pages from Vercel)
            if (responseText.includes('Request Entity Too Large') || res.status === 413) {
              errorMessage = 'PDF file too large for processing. Try a smaller PDF or contact support.'
            } else if (responseText.includes('Bad Request') || res.status === 400) {
              errorMessage = 'Invalid PDF URL or file format'
            } else {
              errorMessage = `URL upload failed (${res.status}): ${responseText.substring(0, 100)}...`
            }
          }
        } catch (readError) {
          errorMessage = `URL upload failed (${res.status}): Unable to read response`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      setUploadProgress('PDF indexed successfully!')
      
      // Refresh the PDF list
      await fetchPDFs()
      
      // Clear the URL input
      setPdfUrl('')

      setTimeout(() => setUploadProgress(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'URL upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle regular chat submission
  const handleRegularChat = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setResponse('')

    const requestData = {
      ...regularFormData,
      api_key: apiKey,
      model
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!res.ok) {
        let errorMessage = 'Request failed'
        try {
          // Read response as text first, then try to parse as JSON
          const responseText = await res.text()
          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.detail || errorData.error || 'Request failed'
          } catch (jsonParseError) {
            // Handle non-JSON responses
            errorMessage = `Request failed (${res.status}): ${responseText.substring(0, 100)}...`
          }
        } catch (readError) {
          errorMessage = `Request failed (${res.status}): Unable to read response`
        }
        throw new Error(errorMessage)
      }

      const reader = res.body?.getReader()
      if (reader) {
        let accumulatedResponse = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = new TextDecoder().decode(value)
          accumulatedResponse += chunk
          setResponse(accumulatedResponse)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle PDF chat submission
  const handlePDFChat = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedPdfIds.length === 0) {
      setError('Please select at least one PDF for analysis')
      return
    }

    if (selectedPdfIds.length > 3) {
      setError('Maximum 3 PDFs can be selected for analysis')
      return
    }

    setIsLoading(true)
    setError('')
    setResponse('')

    const requestData = {
      ...pdfFormData,
      pdf_ids: selectedPdfIds,
      api_key: apiKey,
      model
    }

    try {
      const res = await fetch('/api/chat-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!res.ok) {
        let errorMessage = 'Request failed'
        try {
          // Read response as text first, then try to parse as JSON
          const responseText = await res.text()
          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.detail || errorData.error || 'Request failed'
          } catch (jsonParseError) {
            // Handle non-JSON responses
            errorMessage = `Request failed (${res.status}): ${responseText.substring(0, 100)}...`
          }
        } catch (readError) {
          errorMessage = `Request failed (${res.status}): Unable to read response`
        }
        throw new Error(errorMessage)
      }

      const reader = res.body?.getReader()
      if (reader) {
        let accumulatedResponse = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = new TextDecoder().decode(value)
          accumulatedResponse += chunk
          setResponse(accumulatedResponse)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle regular input changes
  const handleRegularInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setRegularFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle PDF input changes
  const handlePDFInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setPdfFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle single PDF selection
  const handleSinglePdfSelection = (pdfId: string) => {
    setSelectedPdfIds(pdfId ? [pdfId] : [])
  }

  // Handle multiple PDF selection
  const handleMultiplePdfSelection = (pdfId: string, checked: boolean) => {
    if (checked) {
      if (selectedPdfIds.length >= 3) {
        setError('Maximum 3 PDFs can be selected for analysis')
        return
      }
      setSelectedPdfIds(prev => [...prev, pdfId])
    } else {
      setSelectedPdfIds(prev => prev.filter(id => id !== pdfId))
    }
    setError('') // Clear any previous error
  }

  // Handle selection mode change
  const handleSelectionModeChange = (mode: 'single' | 'multiple') => {
    setPdfSelectionMode(mode)
    setSelectedPdfIds([])
    setError('')
  }

  return (
    <div>
      {/* Header */}
      <header className="apple-header">
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        <div className="apple-container apple-header-content">
          <h1 className="apple-title">Research Publication Assistant</h1>
          <p className="apple-subtitle">
            Chat with AI models and analyze research papers with advanced RAG capabilities
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="apple-main">
        <div className="apple-container">
          {/* Configuration Section */}
          <section className="apple-section">
            <h2 className="apple-section-title">Configuration</h2>
            <div className="apple-grid-2">
              <div>
                <label className="apple-label">OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key"
                  className="apple-input"
                />
              </div>
              <div>
                <label className="apple-label">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="apple-select"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
            </div>
          </section>

          {/* Mode Selection */}
          <section className="apple-section">
            <h2 className="apple-section-title">Choose Your Mode</h2>
            <div className="apple-mode-toggle">
              <button
                onClick={() => setChatMode('regular')}
                className={`apple-mode-button ${chatMode === 'regular' ? 'active' : ''}`}
              >
                General Chat
              </button>
              <button
                onClick={() => setChatMode('pdf')}
                className={`apple-mode-button ${chatMode === 'pdf' ? 'active' : ''}`}
              >
                Research Analysis
              </button>
            </div>
          </section>

          {/* PDF Upload Section */}
          {chatMode === 'pdf' && (
            <section className="apple-section">
              <h2 className="apple-section-title">Upload Research Documents</h2>
              
              {/* Upload Type Toggle */}
              <div className="apple-mode-toggle" style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={() => setUploadType('file')}
                  className={`apple-mode-button ${uploadType === 'file' ? 'active' : ''}`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setUploadType('url')}
                  className={`apple-mode-button ${uploadType === 'url' ? 'active' : ''}`}
                >
                  From URL
                </button>
              </div>

              {/* File Upload */}
              {uploadType === 'file' && (
                <div className="apple-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                    Click to upload PDF
                  </div>
                  <div className="apple-caption">
                    Select a research paper or academic document (PDF format only, max 4.5MB)
                  </div>
                </div>
              )}

              {/* URL Upload */}
              {uploadType === 'url' && (
                <div>
                  <label className="apple-label">PDF URL</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="url"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      placeholder="https://example.com/research-paper.pdf (up to ~50MB)"
                      className="apple-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={handleUrlUpload}
                      disabled={isUploading || !pdfUrl.trim()}
                      className="apple-button apple-button-primary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploadProgress && (
                <div className="apple-success">
                  {uploadProgress}
                </div>
              )}

              <p className="apple-caption" style={{ marginBottom: '1.5rem' }}>
                URL uploads can handle much larger files than direct uploads since they bypass Vercel's request body limits. Practical limit: ~50-100MB depending on processing complexity.
              </p>
            </section>
          )}

          {/* PDF Selection Section */}
          {chatMode === 'pdf' && uploadedPDFs.length > 0 && (
            <section className="apple-section">
              <h2 className="apple-section-title">Select Research Documents</h2>
              <p className="apple-caption" style={{ marginBottom: '1.5rem' }}>
                Choose up to 3 research documents for analysis and comparison
              </p>
              
              {/* Selection Mode Toggle */}
              <div className="apple-mode-toggle" style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={() => handleSelectionModeChange('single')}
                  className={`apple-mode-button ${pdfSelectionMode === 'single' ? 'active' : ''}`}
                >
                  Single Document
                </button>
                <button
                  onClick={() => handleSelectionModeChange('multiple')}
                  className={`apple-mode-button ${pdfSelectionMode === 'multiple' ? 'active' : ''}`}
                >
                  Compare Documents
                </button>
              </div>

              {/* Single PDF Selection */}
              {pdfSelectionMode === 'single' && (
                <div>
                  <label className="apple-label">Select Document</label>
                  <select
                    value={selectedPdfIds[0] || ''}
                    onChange={(e) => handleSinglePdfSelection(e.target.value)}
                    className="apple-select"
                  >
                    <option value="">Choose a research document...</option>
                    {uploadedPDFs.map((pdf) => (
                      <option key={pdf.pdf_id} value={pdf.pdf_id}>
                        {pdf.filename} ({pdf.source === 'url' ? 'URL' : 'File'} • {pdf.num_chunks} sections)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Multiple PDF Selection */}
              {pdfSelectionMode === 'multiple' && (
                <div className="apple-pdf-grid">
                  {uploadedPDFs.map((pdf) => (
                    <div
                      key={pdf.pdf_id}
                      className={`apple-pdf-item ${selectedPdfIds.includes(pdf.pdf_id) ? 'selected' : ''}`}
                      onClick={() => handleMultiplePdfSelection(pdf.pdf_id, !selectedPdfIds.includes(pdf.pdf_id))}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPdfIds.includes(pdf.pdf_id)}
                        onChange={(e) => handleMultiplePdfSelection(pdf.pdf_id, e.target.checked)}
                        className="apple-checkbox"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="apple-pdf-info">
                        <div className="apple-pdf-title">{pdf.filename}</div>
                        <div className="apple-pdf-meta">
                          {pdf.source === 'url' ? 'From URL' : 'Uploaded File'} • {pdf.num_chunks} sections • {pdf.total_characters.toLocaleString()} characters
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {selectedPdfIds.length > 0 && (
                    <div className="apple-success">
                      ✓ {selectedPdfIds.length} document{selectedPdfIds.length > 1 ? 's' : ''} selected for analysis
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Chat Section */}
          <section className="apple-section">
            <h2 className="apple-section-title">
              {chatMode === 'regular' ? 'Chat with AI' : 'Research Analysis'}
            </h2>
            
            <form onSubmit={chatMode === 'regular' ? handleRegularChat : handlePDFChat}>
              {chatMode === 'regular' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="apple-label">Developer Message (Optional)</label>
                  <textarea
                    name="developer_message"
                    value={regularFormData.developer_message}
                    onChange={handleRegularInputChange}
                    placeholder="Enter instructions or context for the AI..."
                    className="apple-textarea"
                    rows={3}
                  />
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="apple-label">
                  {chatMode === 'regular' ? 'Your Message' : 'Your Question'}
                </label>
                <textarea
                  name="user_message"
                  value={chatMode === 'regular' ? regularFormData.user_message : pdfFormData.user_message}
                  onChange={chatMode === 'regular' ? handleRegularInputChange : handlePDFInputChange}
                  placeholder={
                    chatMode === 'regular' 
                      ? "Ask me anything..."
                      : pdfSelectionMode === 'multiple' && selectedPdfIds.length > 1 
                        ? "Ask questions to analyze or compare the selected research documents..."
                        : "Ask a question about the selected research document..."
                  }
                  className="apple-textarea"
                  rows={4}
                />
              </div>

              {error && (
                <div className="apple-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !apiKey || (chatMode === 'pdf' && selectedPdfIds.length === 0)}
                className="apple-button apple-button-primary"
                style={{ width: '100%' }}
              >
                {isLoading ? (
                  <div className="apple-loading">
                    <div className="apple-spin" style={{ width: '1rem', height: '1rem', border: '2px solid #ffffff40', borderTop: '2px solid #ffffff', borderRadius: '50%' }}></div>
                    {chatMode === 'regular' ? 'Thinking...' : 'Analyzing...'}
                  </div>
                ) : (
                  <>
                    {chatMode === 'regular' ? '💬 Send Message' : '🔍 Analyze Documents'}
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Response Section */}
          {response && (
            <section className="apple-response apple-fade-in">
              <h3 className="apple-section-title" style={{ marginBottom: '1.5rem' }}>Response</h3>
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const isCodeBlock = className?.includes('language-')
                    
                    return isCodeBlock ? (
                      <pre style={{ 
                        background: 'var(--apple-surface)', 
                        padding: '1.5rem', 
                        borderRadius: '12px', 
                        overflow: 'auto',
                        border: '1px solid var(--apple-border)',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        fontFamily: 'Monaco, Menlo, "SF Mono", Consolas, "Liberation Mono", "Courier New", monospace'
                      }}>
                        <code 
                          className={className} 
                          style={{ 
                            background: 'transparent',
                            padding: '0',
                            border: 'none',
                            borderRadius: '0'
                          }}
                          {...props}
                        >
                          {children}
                        </code>
                      </pre>
                    ) : (
                      <code 
                        className={className} 
                        style={{
                          background: 'var(--apple-surface)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--apple-border)',
                          fontSize: '0.875rem',
                          fontFamily: 'Monaco, Menlo, "SF Mono", Consolas, "Liberation Mono", "Courier New", monospace'
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {response}
              </ReactMarkdown>
            </section>
          )}
        </div>
      </main>
    </div>
  )
} 