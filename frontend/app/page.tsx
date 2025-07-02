'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light'
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism'
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'

// Register languages for Prism
SyntaxHighlighter.registerLanguage('javascript', js)
SyntaxHighlighter.registerLanguage('js', js)
SyntaxHighlighter.registerLanguage('typescript', ts)
SyntaxHighlighter.registerLanguage('ts', ts)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('py', python)
SyntaxHighlighter.registerLanguage('json', json)

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

  // Handle PDF upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!apiKey) {
      setError('Please enter your OpenAI API key first')
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
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Upload failed')
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
        const errorData = await res.json()
        throw new Error(errorData.error || 'URL upload failed')
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

    const requestData = { ...regularFormData, api_key: apiKey, model }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }

      const decoder = new TextDecoder()
      let currentResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        currentResponse += chunk
        setResponse(currentResponse)
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
      setError('Please select at least one PDF')
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
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }

      const decoder = new TextDecoder()
      let currentResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        currentResponse += chunk
        setResponse(currentResponse)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegularInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setRegularFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePDFInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setPdfFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Initialize PDFs on component mount
  useEffect(() => {
    fetchPDFs()
  }, [])

  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--dracula-bg)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Terminal Window */}
        <div className="terminal-window">
          {/* Terminal Header */}
          <div className="terminal-header">
            <div className="terminal-controls">
              <button className="terminal-button close"></button>
              <button className="terminal-button minimize"></button>
              <button className="terminal-button maximize"></button>
            </div>
            <div className="terminal-title">
              pdf-rag-chat — zsh — 120×40
            </div>
          </div>

          {/* Terminal Content */}
          <div className="p-6">
            {/* Welcome Header */}
            <div className="mb-8">
              <div className="text-2xl font-bold mb-2" style={{ color: 'var(--dracula-purple)' }}>
                <span style={{ color: 'var(--dracula-green)' }}>❯</span> PDF RAG Chat Terminal
              </div>
              <div className="text-sm" style={{ color: 'var(--dracula-comment)' }}>
                // Chat with AI or upload PDFs and ask questions about their content
              </div>
            </div>

            {/* Mode Selection */}
            <div className="mb-6">
              <div className="terminal-prompt text-sm mb-3">
                mode_selection
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setChatMode('regular')}
                  className={`px-4 py-2 rounded-md text-sm font-mono transition-all ${
                    chatMode === 'regular'
                      ? 'terminal-button-primary'
                      : 'terminal-button-secondary'
                  }`}
                >
                  Regular Chat
                </button>
                <button
                  onClick={() => setChatMode('pdf')}
                  className={`px-4 py-2 rounded-md text-sm font-mono transition-all ${
                    chatMode === 'pdf'
                      ? 'terminal-button-primary'
                      : 'terminal-button-secondary'
                  }`}
                >
                  PDF Chat (RAG)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Configuration Panel */}
              <div>
                <div className="mb-4">
                  <div className="terminal-prompt text-sm">
                    config
                  </div>
                </div>

                {/* Global Settings */}
                <div className="space-y-4 mb-6">
                  {/* API Key */}
                  <div>
                    <label className="terminal-label block mb-2">
                      api_key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="terminal-input w-full px-4 py-3 rounded-md text-sm"
                      required
                    />
                  </div>

                  {/* Model Selection */}
                  <div>
                    <label className="terminal-label block mb-2">
                      model
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="terminal-input w-full px-4 py-3 rounded-md text-sm"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>
                </div>

                {/* PDF Upload Section (shown in PDF mode) */}
                {chatMode === 'pdf' && (
                  <div className="mb-6 p-4 rounded-md" style={{ background: 'var(--dracula-current-line)' }}>
                    <div className="terminal-prompt text-sm mb-3">
                      pdf_upload
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="terminal-label block mb-2">
                          upload_method
                        </label>
                        <div className="flex gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setUploadType('file')}
                            className={`px-3 py-1 rounded text-xs font-mono ${uploadType === 'file' 
                              ? 'terminal-button-primary' 
                              : 'border border-gray-500 text-gray-300'}`}
                          >
                            file
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadType('url')}
                            className={`px-3 py-1 rounded text-xs font-mono ${uploadType === 'url' 
                              ? 'terminal-button-primary' 
                              : 'border border-gray-500 text-gray-300'}`}
                          >
                            url
                          </button>
                        </div>

                        {uploadType === 'file' ? (
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            disabled={isUploading || !apiKey}
                            className="terminal-input w-full px-4 py-3 rounded-md text-sm"
                          />
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="url"
                              placeholder="https://example.com/document.pdf"
                              value={pdfUrl}
                              onChange={(e) => setPdfUrl(e.target.value)}
                              disabled={isUploading || !apiKey}
                              className="terminal-input flex-1 px-4 py-3 rounded-md text-sm"
                            />
                            <button
                              type="button"
                              onClick={handleUrlUpload}
                              disabled={isUploading || !pdfUrl.trim() || !apiKey}
                              className="terminal-button-primary px-4 py-3 rounded-md text-sm font-mono disabled:opacity-50"
                            >
                              upload
                            </button>
                          </div>
                        )}

                        {!apiKey && (
                          <div className="text-xs mt-1" style={{ color: 'var(--dracula-orange)' }}>
                            Enter API key first
                          </div>
                        )}
                      </div>

                      {(isUploading || uploadProgress) && (
                        <div className="text-sm" style={{ color: 'var(--dracula-cyan)' }}>
                          {isUploading && (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              {uploadProgress}
                            </div>
                          )}
                          {!isUploading && uploadProgress && (
                            <div style={{ color: 'var(--dracula-green)' }}>
                              ✓ {uploadProgress}
                            </div>
                          )}
                        </div>
                      )}

                                            {/* PDF Selection for Research Analysis */}
                      {uploadedPDFs.length > 0 && (
                        <div>
                          <label className="terminal-label block mb-2">
                            research_documents
                          </label>
                          
                          {/* Selection Mode Toggle */}
                          <div className="flex gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => handleSelectionModeChange('single')}
                              className={`px-3 py-1 rounded text-xs font-mono ${pdfSelectionMode === 'single' 
                                ? 'terminal-button-primary' 
                                : 'border border-gray-500 text-gray-300'}`}
                            >
                              single
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectionModeChange('multiple')}
                              className={`px-3 py-1 rounded text-xs font-mono ${pdfSelectionMode === 'multiple' 
                                ? 'terminal-button-primary' 
                                : 'border border-gray-500 text-gray-300'}`}
                            >
                              compare (max 3)
                            </button>
                          </div>

                          {/* Single PDF Selection */}
                          {pdfSelectionMode === 'single' && (
                            <select
                              value={selectedPdfIds[0] || ''}
                              onChange={(e) => handleSinglePdfSelection(e.target.value)}
                              className="terminal-input w-full px-4 py-3 rounded-md text-sm"
                            >
                              <option value="">Select a research document...</option>
                              {uploadedPDFs.map((pdf) => (
                                <option key={pdf.pdf_id} value={pdf.pdf_id}>
                                  {pdf.filename} ({pdf.source === 'url' ? 'URL' : 'File'}, {pdf.num_chunks} chunks)
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Multiple PDF Selection */}
                          {pdfSelectionMode === 'multiple' && (
                            <div className="space-y-2">
                              <div className="text-xs mb-2" style={{ color: 'var(--dracula-comment)' }}>
                                Select up to 3 research documents for comparative analysis:
                              </div>
                              {uploadedPDFs.map((pdf) => (
                                <label key={pdf.pdf_id} className="flex items-center gap-3 p-2 rounded" style={{ background: 'var(--dracula-current-line)' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedPdfIds.includes(pdf.pdf_id)}
                                    onChange={(e) => handleMultiplePdfSelection(pdf.pdf_id, e.target.checked)}
                                    className="rounded"
                                    style={{ accentColor: 'var(--dracula-purple)' }}
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{pdf.filename}</div>
                                    <div className="text-xs" style={{ color: 'var(--dracula-comment)' }}>
                                      {pdf.source === 'url' ? 'URL' : 'File'} • {pdf.num_chunks} chunks • {pdf.total_characters} chars
                                    </div>
                                  </div>
                                </label>
                              ))}
                              {selectedPdfIds.length > 0 && (
                                <div className="text-xs mt-2" style={{ color: 'var(--dracula-green)' }}>
                                  ✓ {selectedPdfIds.length} document{selectedPdfIds.length > 1 ? 's' : ''} selected for analysis
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Chat Form */}
                <form onSubmit={chatMode === 'regular' ? handleRegularChat : handlePDFChat} className="space-y-6">
                  {chatMode === 'regular' && (
                    <>
                      {/* System Prompt */}
                      <div>
                        <label className="terminal-label block mb-2">
                          system_prompt
                        </label>
                        <textarea
                          name="developer_message"
                          value={regularFormData.developer_message}
                          onChange={handleRegularInputChange}
                          placeholder="You are a helpful assistant..."
                          rows={3}
                          className="terminal-input w-full px-4 py-3 rounded-md text-sm resize-y"
                          required
                        />
                      </div>

                      {/* User Input */}
                      <div>
                        <label className="terminal-label block mb-2">
                          user_input
                        </label>
                        <textarea
                          name="user_message"
                          value={regularFormData.user_message}
                          onChange={handleRegularInputChange}
                          placeholder="Enter your message here..."
                          rows={4}
                          className="terminal-input w-full px-4 py-3 rounded-md text-sm resize-y"
                          required
                        />
                      </div>
                    </>
                  )}

                  {chatMode === 'pdf' && (
                    <div>
                      <label className="terminal-label block mb-2">
                        pdf_question
                      </label>
                      <textarea
                        name="user_message"
                        value={pdfFormData.user_message}
                        onChange={handlePDFInputChange}
                        placeholder={pdfSelectionMode === 'multiple' && selectedPdfIds.length > 1 
                          ? "Ask questions to analyze or compare the selected research documents..."
                          : "Ask a question about the selected research document..."}
                        rows={4}
                        className="terminal-input w-full px-4 py-3 rounded-md text-sm resize-y"
                        required
                      />
                    </div>
                  )}

                  {/* Execute Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !apiKey || (chatMode === 'pdf' && selectedPdfIds.length === 0)}
                    className="terminal-button-primary w-full py-3 px-6 rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    {isLoading ? (
                      <>
                        <div className="terminal-loading">
                          {chatMode === 'pdf' ? 'searching_pdf' : 'executing'}
                        </div>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      </>
                    ) : (
                      <>
                        <span style={{ color: 'var(--dracula-green)' }}>▶</span>
                        {chatMode === 'pdf' ? 'ask_pdf' : 'execute_query'}
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Output Panel */}
              <div>
                <div className="mb-4">
                  <div className="terminal-prompt text-sm">
                    output
                  </div>
                </div>
                
                <div className="terminal-output rounded-md p-4 min-h-[500px] max-h-[600px] overflow-y-auto">
                  {error && (
                    <div className="terminal-error p-4 rounded-md mb-4 text-sm">
                      <div className="font-bold mb-1">ERROR:</div>
                      <div className="font-mono">{error}</div>
                    </div>
                  )}
                  
                  {response && (
                    <div className="space-y-2">
                      <div className="text-xs mb-2" style={{ color: 'var(--dracula-comment)' }}>
                        // {chatMode === 'pdf' ? 'PDF RAG Response Stream' : 'AI Response Stream'}
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--dracula-foreground)' }}>
                        <ReactMarkdown
                          components={{
                            h1: ({node, ...props}) => <h1 style={{color: 'var(--dracula-pink)', fontWeight: 700, fontSize: '1.5em', margin: '1em 0 0.5em'}} {...props} />,
                            h2: ({node, ...props}) => <h2 style={{color: 'var(--dracula-purple)', fontWeight: 700, fontSize: '1.2em', margin: '1em 0 0.5em'}} {...props} />,
                            h3: ({node, ...props}) => <h3 style={{color: 'var(--dracula-cyan)', fontWeight: 700, fontSize: '1em', margin: '1em 0 0.5em'}} {...props} />,
                            code({node, ...props}: any) {
                              const {inline, className, children, ...rest} = props;
                              const match = /language-(\w+)/.exec(className || '');
                              if (!inline && match) {
                                return (
                                  <SyntaxHighlighter
                                    style={dracula}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{
                                      borderRadius: 8,
                                      margin: '0.5em 0',
                                      fontSize: '0.95em',
                                      background: 'var(--dracula-current-line)',
                                    }}
                                    {...rest}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                );
                              } else {
                                return (
                                  <code
                                    className={className}
                                    style={{
                                      background: 'var(--dracula-current-line)',
                                      color: 'var(--dracula-green)',
                                      borderRadius: 4,
                                      padding: '2px 6px',
                                      fontSize: '0.95em',
                                    }}
                                    {...rest}
                                  >{children}</code>
                                );
                              }
                            },
                            blockquote: ({node, ...props}) =>
                              <blockquote style={{borderLeft: '4px solid var(--dracula-purple)', background: 'rgba(189,147,249,0.08)', color: 'var(--dracula-comment)', padding: '0.5em 1em', margin: '1em 0'}} {...props} />,
                            a: ({node, ...props}) => <a style={{color: 'var(--dracula-cyan)', textDecoration: 'underline'}} {...props} />,
                            ul: ({node, ...props}) => <ul style={{marginLeft: '1.5em', listStyle: 'disc'}} {...props} />,
                            ol: ({node, ...props}) => <ol style={{marginLeft: '1.5em', listStyle: 'decimal'}} {...props} />,
                            li: ({node, ...props}) => <li style={{margin: '0.25em 0'}} {...props} />,
                            strong: ({node, ...props}) => <strong style={{color: 'var(--dracula-yellow)'}} {...props} />,
                            em: ({node, ...props}) => <em style={{color: 'var(--dracula-orange)'}} {...props} />,
                            hr: ({node, ...props}) => <hr style={{borderColor: 'var(--dracula-comment)', margin: '1em 0'}} {...props} />,
                            p: ({node, ...props}) => <p style={{margin: '0.5em 0'}} {...props} />,
                          }}
                        >
                          {response}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  {!response && !error && !isLoading && (
                    <div className="text-center py-12" style={{ color: 'var(--dracula-comment)' }}>
                      <div className="text-lg mb-2">
                        <span style={{ color: 'var(--dracula-cyan)' }}>◉</span> Ready for {chatMode === 'pdf' ? 'PDF questions' : 'input'}
                      </div>
                      <div className="text-sm">
                        {chatMode === 'pdf' 
                          ? 'Upload a PDF and ask questions about its content using RAG.'
                          : 'Configure your settings and execute a query to see the AI response stream here.'
                        }
                      </div>
                    </div>
                  )}
                  
                  {isLoading && !response && (
                    <div className="text-center py-12">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--dracula-cyan)' }}></div>
                        <div className="terminal-loading text-lg">
                          {chatMode === 'pdf' ? 'searching pdf content' : 'awaiting response'}
                        </div>
                      </div>
                      <div className="text-sm" style={{ color: 'var(--dracula-comment)' }}>
                        // {chatMode === 'pdf' ? 'Retrieving relevant content and generating response...' : 'Streaming data from OpenAI API...'}
                      </div>
                    </div>
                  )}
                  
                  {/* Cursor for terminal feel */}
                  {(response || isLoading) && (
                    <div className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ background: 'var(--dracula-green)' }}></div>
                  )}
                </div>
              </div>
            </div>

            {/* Terminal Footer */}
            <div className="mt-8 pt-4 border-t" style={{ borderColor: 'var(--dracula-current-line)' }}>
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--dracula-comment)' }}>
                <div>
                  <span style={{ color: 'var(--dracula-green)' }}>●</span> Connected to PDF RAG Backend
                </div>
                <div>
                  Built with aimakerspace + Next.js + FastAPI
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 