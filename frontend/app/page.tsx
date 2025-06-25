'use client'

import { useState } from 'react'
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