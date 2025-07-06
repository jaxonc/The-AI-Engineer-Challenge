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
  context_summary?: string
}

interface UploadedPDF {
  pdf_id: string
  filename: string
  paper_title?: string
  source?: string
  url?: string
  num_chunks: number
  total_characters: number
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  mode: 'regular' | 'pdf'
  pdfIds?: string[]
}

type ChatMode = 'regular' | 'pdf'

export default function Home() {
  const [chatMode, setChatMode] = useState<ChatMode>('regular')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  
  // Separate chat histories for each mode
  const [regularChatHistory, setRegularChatHistory] = useState<ChatMessage[]>([])
  const [pdfChatHistory, setPdfChatHistory] = useState<ChatMessage[]>([])
  
  // Context memory system - lightweight conversation summaries
  const [regularContextSummary, setRegularContextSummary] = useState('')
  const [pdfContextSummary, setPdfContextSummary] = useState('')
  
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const chatHistoryRef = useRef<HTMLDivElement>(null)

  // Regular chat state (simplified)
  const [regularFormData, setRegularFormData] = useState<ChatRequest>({
    developer_message: '',
    user_message: '',
    model: 'gpt-4o-mini',
    api_key: ''
  })

  // Multi-PDF selection state
  const [pdfSelectionMode, setPdfSelectionMode] = useState<'single' | 'multiple'>('single')
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([])

  // PDF upload state
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file')
  const [pdfUrl, setPdfUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get current chat history based on mode
  const getCurrentChatHistory = () => {
    return chatMode === 'regular' ? regularChatHistory : pdfChatHistory
  }

  // Set chat history for current mode
  const setCurrentChatHistory = (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (typeof history === 'function') {
      if (chatMode === 'regular') {
        setRegularChatHistory(history)
      } else {
        setPdfChatHistory(history)
      }
    } else {
      if (chatMode === 'regular') {
        setRegularChatHistory(history)
      } else {
        setPdfChatHistory(history)
      }
    }
  }

  // Get current context summary
  const getCurrentContextSummary = () => {
    return chatMode === 'regular' ? regularContextSummary : pdfContextSummary
  }

  // Set context summary for current mode
  const setCurrentContextSummary = (summary: string) => {
    if (chatMode === 'regular') {
      setRegularContextSummary(summary)
    } else {
      setPdfContextSummary(summary)
    }
  }

  // Auto-scroll chat history
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [getCurrentChatHistory(), chatMode])

  // Update document title based on mode
  useEffect(() => {
    if (chatMode === 'regular') {
      document.title = 'OpenAI API Chat Interface'
    } else {
      document.title = 'Research Literature Review Assistant'
    }
  }, [chatMode])

  // Create conversation summary from recent messages
  const createConversationSummary = async (messages: ChatMessage[]): Promise<string> => {
    if (messages.length === 0) return ''
    
    // Take last 20 messages for summarization
    const recentMessages = messages.slice(-20)
    const conversationText = recentMessages
      .map(msg => `${msg.type.toUpperCase()}: ${msg.content}`)
      .join('\n')
    
    if (!apiKey || conversationText.length < 100) return ''

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          developer_message: "Summarize this conversation in 2-3 sentences, focusing on key topics, decisions, and context that would be helpful for continuing the conversation. Be concise but include important details.",
          user_message: `Please summarize this recent conversation:\n\n${conversationText}`,
          api_key: apiKey,
          model: 'gpt-4o-mini'
        }),
      })

      if (res.ok) {
        const reader = res.body?.getReader()
        if (reader) {
          let summary = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            summary += new TextDecoder().decode(value)
          }
          return summary.trim()
        }
      }
    } catch (err) {
      console.error('Failed to create conversation summary:', err)
    }
    
    return ''
  }

  // Check if summary should be updated (first time at 25 messages)
  const shouldUpdateSummary = (history: ChatMessage[]): boolean => {
    return history.length === 25
  }

  // Build context from recent messages (for conversations under 25 messages)
  const buildRecentMessageContext = (history: ChatMessage[]): string => {
    if (history.length === 0) return ''
    
    // Take last 10 messages for context (or all if less than 10)
    const recentMessages = history.slice(-10)
    const contextMessages = recentMessages
      .map(msg => `${msg.type.toUpperCase()}: ${msg.content}`)
      .join('\n')
    
    return contextMessages ? `Recent conversation context:\n${contextMessages}` : ''
  }

  // Get comprehensive context (summary + recent messages or just recent messages)
  const getComprehensiveContext = (mode: ChatMode): string => {
    // Get history and summary for the specified mode, not current UI mode
    const currentHistory = mode === 'regular' ? regularChatHistory : pdfChatHistory
    const summary = mode === 'regular' ? regularContextSummary : pdfContextSummary
    
    if (currentHistory.length < 25) {
      // Phase 1: Use recent messages (1-24 messages)
      return buildRecentMessageContext(currentHistory)
    } else {
      // Phase 2: Use summary + last 5 messages (25+ messages)
      const recentMessages = currentHistory.slice(-5)
      const recentContext = recentMessages
        .map(msg => `${msg.type.toUpperCase()}: ${msg.content}`)
        .join('\n')
      
      if (summary && recentContext) {
        return `Previous conversation summary: ${summary}\n\nRecent messages:\n${recentContext}`
      } else if (summary) {
        return `Previous conversation summary: ${summary}`
      } else if (recentContext) {
        return `Recent conversation context:\n${recentContext}`
      }
    }
    
    return ''
  }

  // Add message to chat history
  const addMessage = (type: 'user' | 'assistant', content: string, mode: ChatMode, pdfIds?: string[]) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      mode,
      pdfIds
    }
    
    // Use the message mode, not the current UI mode
    if (mode === 'regular') {
      setRegularChatHistory((prev: ChatMessage[]) => [...prev, message])
    } else {
      setPdfChatHistory((prev: ChatMessage[]) => [...prev, message])
    }
  }

  // Update last assistant message (for streaming)
  const updateLastAssistantMessage = (content: string, mode: ChatMode) => {
    // Use the message mode, not the current UI mode
    if (mode === 'regular') {
      setRegularChatHistory((prev: ChatMessage[]) => {
        const newHistory = [...prev]
        const lastMessage = newHistory[newHistory.length - 1]
        if (lastMessage && lastMessage.type === 'assistant') {
          lastMessage.content = content
        }
        return newHistory
      })
    } else {
      setPdfChatHistory((prev: ChatMessage[]) => {
        const newHistory = [...prev]
        const lastMessage = newHistory[newHistory.length - 1]
        if (lastMessage && lastMessage.type === 'assistant') {
          lastMessage.content = content
        }
        return newHistory
      })
    }
  }

  // Fetch uploaded PDFs
  const fetchPDFs = async () => {
    if (!apiKey) return
    
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

  // Initialize PDFs when API key is available
  useEffect(() => {
    if (apiKey) {
      fetchPDFs()
    }
  }, [apiKey])

  // Handle PDF upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!apiKey) {
      setError('Please enter your OpenAI API key first')
      return
    }

    // Client-side file size validation (4.5MB limit - Vercel's hard limit)
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

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return
    if (!apiKey) {
      setError('Please enter your OpenAI API key first')
      return
    }

    const userMessage = currentMessage.trim()
    setCurrentMessage('')
    setIsLoading(true)
    setError('')

    // Capture the mode at the beginning to prevent race conditions
    const messageMode = chatMode
    const messagePdfIds = messageMode === 'pdf' ? selectedPdfIds : undefined

    // Add user message to history
    addMessage('user', userMessage, messageMode, messagePdfIds)

    // Add empty assistant message for streaming
    addMessage('assistant', '', messageMode, messagePdfIds)

    try {
      let requestData: any
      let endpoint: string

      // Get comprehensive context
      const context = getComprehensiveContext(messageMode)

      if (messageMode === 'regular') {
        // Include context in developer message for regular chat
        let developerMessage = regularFormData.developer_message
        if (context) {
          developerMessage = `Previous conversation context: ${context}\n\n${developerMessage || 'You are a helpful AI assistant.'}`
        }

        requestData = {
          developer_message: developerMessage,
          user_message: userMessage,
          api_key: apiKey,
          model
        }
        endpoint = '/api/chat'
      } else {
        if (selectedPdfIds.length === 0) {
          setError('Please select at least one PDF for analysis')
          return
        }
        
        requestData = {
          user_message: userMessage,
          pdf_ids: selectedPdfIds,
          api_key: apiKey,
          model,
          context_summary: context // Include context for PDF chat
        }
        endpoint = '/api/chat-pdf'
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!res.ok) {
        let errorMessage = 'Request failed'
        try {
          const responseText = await res.text()
          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.detail || errorData.error || 'Request failed'
          } catch (jsonParseError) {
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
          updateLastAssistantMessage(accumulatedResponse, messageMode)
        }

        // Check if we should update the conversation summary for the message mode
        const messageHistory = messageMode === 'regular' ? regularChatHistory : pdfChatHistory
        if (shouldUpdateSummary(messageHistory)) {
          const newSummary = await createConversationSummary(messageHistory)
          if (newSummary) {
            if (messageMode === 'regular') {
              setRegularContextSummary(newSummary)
            } else {
              setPdfContextSummary(newSummary)
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle key press in message input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="apple-app">
      {/* Galaxy Space Header */}
      <header className="apple-header">
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        <div className="space-particle"></div>
        
        <div className="apple-header-content">
          <h1 className="apple-title">
            {chatMode === 'regular' ? 'OpenAI API Chat Interface' : 'Research Literature Review Assistant'}
          </h1>
          <p className="apple-subtitle">
            {chatMode === 'regular' 
              ? 'Intelligent conversations powered by OpenAI models'
              : 'Advanced research document analysis and insights'}
          </p>
          
          <div className="apple-header-controls">
            <div className="apple-control-group">
              <div className="apple-control-section">
                <label className="apple-control-label">Mode Selection</label>
                <div className="apple-mode-toggle">
                  <button
                    onClick={() => setChatMode('regular')}
                    className={`apple-mode-button ${chatMode === 'regular' ? 'active' : ''}`}
                  >
                    💬 General Chat
                  </button>
                  <button
                    onClick={() => setChatMode('pdf')}
                    className={`apple-mode-button ${chatMode === 'pdf' ? 'active' : ''}`}
                  >
                    📚 Research Analysis
                  </button>
                </div>
              </div>
              
              <div className="apple-control-section">
                <label className="apple-control-label">API Key Input</label>
                <div className="apple-api-key-section">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter OpenAI API key (sk-...)"
                    className="apple-input"
                    style={{ background: 'rgba(255, 255, 255, 0.95)', color: 'var(--apple-primary)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="apple-main">
        <div className="apple-container">
          <div className="chat-layout">
            {/* Sidebar for PDF mode */}
            {chatMode === 'pdf' && (
              <div className="chat-sidebar">
              <div className="sidebar-content">
                <h3 className="sidebar-title">Research Documents</h3>
                
                {/* PDF Upload Section */}
                <div className="sidebar-section">
                  <h4 className="sidebar-section-title">Upload Documents</h4>
                  
                  {/* Upload Type Toggle */}
                  <div className="sidebar-toggle">
                    <button
                      onClick={() => setUploadType('file')}
                      className={`sidebar-toggle-button ${uploadType === 'file' ? 'active' : ''}`}
                    >
                      File
                    </button>
                    <button
                      onClick={() => setUploadType('url')}
                      className={`sidebar-toggle-button ${uploadType === 'url' ? 'active' : ''}`}
                    >
                      URL
                    </button>
                  </div>

                  {/* File Upload */}
                  {uploadType === 'file' && (
                    <div className="sidebar-upload-area" onClick={() => fileInputRef.current?.click()}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                      <div className="upload-icon">📄</div>
                      <div className="upload-text">Upload PDF</div>
                      <div className="upload-caption">Max 4.5MB</div>
                    </div>
                  )}

                  {/* URL Upload */}
                  {uploadType === 'url' && (
                    <div className="sidebar-url-upload">
                      <input
                        type="url"
                        value={pdfUrl}
                        onChange={(e) => setPdfUrl(e.target.value)}
                        placeholder="PDF URL..."
                        className="sidebar-input"
                      />
                      <button
                        onClick={handleUrlUpload}
                        disabled={isUploading || !pdfUrl.trim()}
                        className="sidebar-button"
                      >
                        {isUploading ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  )}

                  {/* Upload Progress */}
                  {uploadProgress && (
                    <div className="sidebar-success">
                      {uploadProgress}
                    </div>
                  )}
                </div>

                {/* PDF Selection Section */}
                {uploadedPDFs.length > 0 && (
                  <div className="sidebar-section">
                    <h4 className="sidebar-section-title">Select Documents</h4>
                    
                    {/* Selection Mode Toggle */}
                    <div className="sidebar-toggle">
                      <button
                        onClick={() => handleSelectionModeChange('single')}
                        className={`sidebar-toggle-button ${pdfSelectionMode === 'single' ? 'active' : ''}`}
                      >
                        Single
                      </button>
                      <button
                        onClick={() => handleSelectionModeChange('multiple')}
                        className={`sidebar-toggle-button ${pdfSelectionMode === 'multiple' ? 'active' : ''}`}
                      >
                        Multiple
                      </button>
                    </div>

                    {/* PDF List */}
                    <div className="sidebar-pdf-list">
                      {uploadedPDFs.map((pdf) => (
                        <div
                          key={pdf.pdf_id}
                          className={`sidebar-pdf-item ${selectedPdfIds.includes(pdf.pdf_id) ? 'selected' : ''}`}
                          onClick={() => {
                            if (pdfSelectionMode === 'single') {
                              handleSinglePdfSelection(selectedPdfIds.includes(pdf.pdf_id) ? '' : pdf.pdf_id)
                            } else {
                              handleMultiplePdfSelection(pdf.pdf_id, !selectedPdfIds.includes(pdf.pdf_id))
                            }
                          }}
                        >
                          {pdfSelectionMode === 'multiple' && (
                            <input
                              type="checkbox"
                              checked={selectedPdfIds.includes(pdf.pdf_id)}
                              onChange={(e) => handleMultiplePdfSelection(pdf.pdf_id, e.target.checked)}
                              className="sidebar-checkbox"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <div className="sidebar-pdf-info">
                            <div className="sidebar-pdf-title">
                              {pdf.paper_title ? pdf.paper_title : pdf.filename}
                            </div>
                            {pdf.paper_title && (
                              <div className="sidebar-pdf-filename">
                                {pdf.filename}
                              </div>
                            )}
                            <div className="sidebar-pdf-meta">
                              {pdf.source === 'url' ? 'URL' : 'File'} • {pdf.num_chunks} sections
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {selectedPdfIds.length > 0 && (
                      <div className="sidebar-success">
                        ✓ {selectedPdfIds.length} document{selectedPdfIds.length > 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Area */}
          <div className="chat-area">
            {/* Chat History */}
            <div className="chat-history" ref={chatHistoryRef}>
              {getCurrentChatHistory().length === 0 ? (
                <div className="chat-welcome">
                  <div className="welcome-icon">
                    {chatMode === 'regular' ? '💬' : '📚'}
                  </div>
                  <h3>
                    {chatMode === 'regular' 
                      ? 'Welcome to OpenAI Chat' 
                      : 'Welcome to Research Analysis'}
                  </h3>
                  <p>
                    {chatMode === 'regular' 
                      ? 'Start a conversation with AI. You can ask questions, request help, or have a discussion on any topic.'
                      : 'Upload research documents and start analyzing them. You can ask questions, compare findings, or explore key insights.'}
                  </p>
                  {!apiKey && (
                    <p className="welcome-hint">
                      👆 Enter your OpenAI API key in the header to get started.
                    </p>
                  )}
                  {chatMode === 'pdf' && selectedPdfIds.length === 0 && apiKey && (
                    <p className="welcome-hint">
                      👈 Upload and select documents from the sidebar to get started.
                    </p>
                  )}
                </div>
              ) : (
                getCurrentChatHistory().map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message ${message.type === 'user' ? 'user' : 'assistant'}`}
                  >
                    <div className="message-content">
                      {message.type === 'assistant' ? (
                        <ReactMarkdown
                          components={{
                            code({ className, children, ...props }) {
                              const isCodeBlock = className?.includes('language-')
                              
                              return isCodeBlock ? (
                                <pre className="code-block">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              ) : (
                                <code className="inline-code" {...props}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <div className="user-message-text">{message.content}</div>
                      )}
                    </div>
                    <div className="message-timestamp">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div className="chat-input-container">
              {/* Developer Message for Regular Chat */}
              {chatMode === 'regular' && (
                <div className="developer-message-section">
                  <input
                    type="text"
                    name="developer_message"
                    value={regularFormData.developer_message}
                    onChange={handleRegularInputChange}
                    placeholder="Optional: Add system instructions or context..."
                    className="developer-input"
                  />
                  {getCurrentContextSummary() && (
                    <div className="context-indicator">
                      🧠 Context memory active ({getCurrentChatHistory().length} messages)
                    </div>
                  )}
                </div>
              )}
              
              {/* PDF Mode Context Indicator */}
              {chatMode === 'pdf' && getCurrentContextSummary() && (
                <div className="context-indicator">
                  🧠 Context memory active ({getCurrentChatHistory().length} messages)
                </div>
              )}
              
              {/* Error Display */}
              {error && (
                <div className="chat-error">
                  {error}
                </div>
              )}

              {/* Message Input */}
              <div className="message-input-section">
                <div className="message-input-container">
                  <textarea
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      !apiKey
                        ? "Enter your API key first..."
                        : chatMode === 'regular' 
                        ? "Type your message..."
                        : selectedPdfIds.length > 0 
                          ? "Ask a question about your documents..."
                          : "Select documents first, then ask your question..."
                    }
                    className="message-input"
                    rows={1}
                    disabled={isLoading || !apiKey || (chatMode === 'pdf' && selectedPdfIds.length === 0)}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !currentMessage.trim() || !apiKey || (chatMode === 'pdf' && selectedPdfIds.length === 0)}
                    className="send-button"
                  >
                    {isLoading ? (
                      <div className="loading-spinner"></div>
                    ) : (
                      '↗️'
                    )}
                  </button>
                </div>
                
                {/* Model Selection */}
                <div className="model-selection">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="model-select"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  )
} 