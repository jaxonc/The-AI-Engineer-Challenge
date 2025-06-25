'use client'

import { useState } from 'react'

interface ChatRequest {
  developer_message: string
  user_message: string
  model: string
  api_key: string
}

export default function Home() {
  const [formData, setFormData] = useState<ChatRequest>({
    developer_message: '',
    user_message: '',
    model: 'gpt-4o-mini',
    api_key: ''
  })
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setResponse('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

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
              openai-chat-interface — zsh — 120×40
            </div>
          </div>

          {/* Terminal Content */}
          <div className="p-6">
            {/* Welcome Header */}
            <div className="mb-8">
              <div className="text-2xl font-bold mb-2" style={{ color: 'var(--dracula-purple)' }}>
                <span style={{ color: 'var(--dracula-green)' }}>❯</span> OpenAI Chat Terminal
              </div>
              <div className="text-sm" style={{ color: 'var(--dracula-comment)' }}>
                // Interactive AI chat interface with streaming responses
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
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* API Key */}
                  <div>
                    <label className="terminal-label block mb-2">
                      api_key
                    </label>
                    <input
                      type="password"
                      name="api_key"
                      value={formData.api_key}
                      onChange={handleInputChange}
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
                      name="model"
                      value={formData.model}
                      onChange={handleInputChange}
                      className="terminal-input w-full px-4 py-3 rounded-md text-sm"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>

                  {/* System Prompt */}
                  <div>
                    <label className="terminal-label block mb-2">
                      system_prompt
                    </label>
                    <textarea
                      name="developer_message"
                      value={formData.developer_message}
                      onChange={handleInputChange}
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
                      value={formData.user_message}
                      onChange={handleInputChange}
                      placeholder="Enter your message here..."
                      rows={4}
                      className="terminal-input w-full px-4 py-3 rounded-md text-sm resize-y"
                      required
                    />
                  </div>

                  {/* Execute Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="terminal-button-primary w-full py-3 px-6 rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    {isLoading ? (
                      <>
                        <div className="terminal-loading">executing</div>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      </>
                    ) : (
                      <>
                        <span style={{ color: 'var(--dracula-green)' }}>▶</span>
                        execute_query
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
                        // AI Response Stream
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--dracula-foreground)' }}>
                        {response}
                      </div>
                    </div>
                  )}
                  
                  {!response && !error && !isLoading && (
                    <div className="text-center py-12" style={{ color: 'var(--dracula-comment)' }}>
                      <div className="text-lg mb-2">
                        <span style={{ color: 'var(--dracula-cyan)' }}>◉</span> Ready for input
                      </div>
                      <div className="text-sm">
                        Configure your settings and execute a query to see the AI response stream here.
                      </div>
                    </div>
                  )}
                  
                  {isLoading && !response && (
                    <div className="text-center py-12">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--dracula-cyan)' }}></div>
                        <div className="terminal-loading text-lg">
                          awaiting response
                        </div>
                      </div>
                      <div className="text-sm" style={{ color: 'var(--dracula-comment)' }}>
                        // Streaming data from OpenAI API...
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
                  <span style={{ color: 'var(--dracula-green)' }}>●</span> Connected to FastAPI backend
                </div>
                <div>
                  Built with Next.js + TypeScript + Dracula Theme
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 