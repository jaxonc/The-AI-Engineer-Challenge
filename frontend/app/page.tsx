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

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface PDF {
  pdf_id: string;
  filename: string;
  source: string;
  url?: string;
  num_chunks: number;
  total_characters: number;
}

export default function Home() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  
  // PDF state
  const [mode, setMode] = useState<'chat' | 'pdf'>('chat');
  const [selectedPdf, setSelectedPdf] = useState<string>('');
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [pdfUrl, setPdfUrl] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (mode === 'pdf') {
      loadPdfs();
    }
  }, [mode]);

  const loadPdfs = async () => {
    try {
      const response = await fetch('/api/pdfs');
      if (response.ok) {
        const data = await response.json();
        setPdfs(data.pdfs || []);
      }
    } catch (error) {
      console.error('Failed to load PDFs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;
    if (!apiKey.trim()) {
      alert('Please enter your OpenAI API key');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      let response;
      
      if (mode === 'pdf' && selectedPdf) {
        // PDF RAG mode
        response = await fetch('/api/chat-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_message: inputMessage,
            pdf_id: selectedPdf,
            model: model,
            api_key: apiKey,
          }),
        });
      } else {
        // Regular chat mode
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            developer_message: "You are a helpful AI assistant. Provide clear, accurate, and helpful responses.",
            user_message: inputMessage,
            model: model,
            api_key: apiKey,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage.content += chunk;
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id ? { ...msg, content: assistantMessage.content } : msg
        ));
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, there was an error processing your request. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!apiKey.trim()) {
      alert('Please enter your OpenAI API key first');
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      alert(`PDF uploaded successfully! ${result.num_chunks} chunks created.`);
      
      // Reload PDFs and select the new one
      await loadPdfs();
      setSelectedPdf(result.pdf_id);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!pdfUrl.trim()) {
      alert('Please enter a PDF URL');
      return;
    }
    
    if (!apiKey.trim()) {
      alert('Please enter your OpenAI API key first');
      return;
    }

    setIsUploading(true);
    
    try {
      const response = await fetch('/api/upload-pdf-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: pdfUrl,
          api_key: apiKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      alert(`PDF uploaded successfully! ${result.num_chunks} chunks created.`);
      
      // Reload PDFs and select the new one
      await loadPdfs();
      setSelectedPdf(result.pdf_id);
      
      // Clear the URL input
      setPdfUrl('');
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePdf = async (pdfId: string) => {
    if (!confirm('Are you sure you want to delete this PDF?')) return;
    
    try {
      const response = await fetch(`/api/pdf/${pdfId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      alert('PDF deleted successfully');
      
      // Reload PDFs
      await loadPdfs();
      
      // Clear selection if deleted PDF was selected
      if (selectedPdf === pdfId) {
        setSelectedPdf('');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete PDF');
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <div className="border-b border-green-400 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">
            {mode === 'chat' ? '> AI_ASSISTANT_TERMINAL' : '> PDF_RAG_SYSTEM'}
          </h1>
          <div className="flex gap-4 items-center">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'chat' | 'pdf')}
              className="bg-black border border-green-400 text-green-400 px-3 py-1 rounded"
            >
              <option value="chat">Chat Mode</option>
              <option value="pdf">PDF RAG Mode</option>
            </select>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-black border border-green-400 text-green-400 px-3 py-1 rounded"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* API Key Input */}
        <div className="mb-4">
          <input
            type="password"
            placeholder="Enter your OpenAI API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-black border border-green-400 text-green-400 px-3 py-2 rounded focus:outline-none focus:border-green-300"
          />
        </div>

        {/* PDF RAG Section */}
        {mode === 'pdf' && (
          <div className="mb-6 border border-green-400 rounded p-4">
            <h2 className="text-lg mb-4">&gt; PDF_MANAGEMENT_SYSTEM</h2>
            
            {/* Upload Type Toggle */}
            <div className="mb-4">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setUploadType('file')}
                  className={`px-4 py-2 rounded border ${
                    uploadType === 'file'
                      ? 'bg-green-400 text-black border-green-400'
                      : 'bg-black text-green-400 border-green-400'
                  }`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setUploadType('url')}
                  className={`px-4 py-2 rounded border ${
                    uploadType === 'url'
                      ? 'bg-green-400 text-black border-green-400'
                      : 'bg-black text-green-400 border-green-400'
                  }`}
                >
                  Upload from URL
                </button>
              </div>

              {uploadType === 'file' ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="bg-black border border-green-400 text-green-400 px-3 py-2 rounded file:bg-green-400 file:text-black file:border-none file:rounded file:px-3 file:py-1 file:mr-3"
                  />
                  {isUploading && <span className="text-yellow-400">Uploading...</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="Enter PDF URL (e.g., https://example.com/document.pdf)"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    disabled={isUploading}
                    className="flex-1 bg-black border border-green-400 text-green-400 px-3 py-2 rounded focus:outline-none focus:border-green-300"
                  />
                  <button
                    onClick={handleUrlUpload}
                    disabled={isUploading || !pdfUrl.trim()}
                    className="px-4 py-2 bg-green-400 text-black rounded hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              )}
            </div>

            {/* PDF Selection */}
            {pdfs.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm mb-2">&gt; SELECT_PDF:</label>
                <select
                  value={selectedPdf}
                  onChange={(e) => setSelectedPdf(e.target.value)}
                  className="w-full bg-black border border-green-400 text-green-400 px-3 py-2 rounded"
                >
                  <option value="">Select a PDF...</option>
                  {pdfs.map((pdf) => (
                    <option key={pdf.pdf_id} value={pdf.pdf_id}>
                      {pdf.filename} ({pdf.source === 'url' ? 'URL' : 'File'}) - {pdf.num_chunks} chunks
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* PDF List */}
            {pdfs.length > 0 && (
              <div>
                <h3 className="text-sm mb-2">&gt; UPLOADED_PDFS:</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {pdfs.map((pdf) => (
                    <div key={pdf.pdf_id} className="flex items-center justify-between text-sm border border-green-400 rounded p-2">
                      <div className="flex-1">
                        <span className="text-green-300">{pdf.filename}</span>
                        <span className="text-gray-500 ml-2">
                          ({pdf.source === 'url' ? 'URL' : 'File'}, {pdf.num_chunks} chunks)
                        </span>
                        {pdf.url && (
                          <div className="text-xs text-gray-400 truncate mt-1">
                            URL: {pdf.url}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeletePdf(pdf.pdf_id)}
                        className="text-red-400 hover:text-red-300 ml-2"
                        title="Delete PDF"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Interface */}
        <div className="border border-green-400 rounded-lg overflow-hidden">
          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 bg-gray-900">
            {messages.length === 0 && (
              <div className="text-center text-gray-500">
                {mode === 'chat' 
                  ? '> TERMINAL_READY... Type your message below.'
                  : selectedPdf 
                    ? '> PDF_LOADED... Ask questions about the document.'
                    : '> UPLOAD_PDF_FIRST... Upload and select a PDF to begin.'
                }
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 ${message.isUser ? 'text-cyan-400' : 'text-green-400'}`}
              >
                <div className="font-bold mb-1">
                  &gt; {message.isUser ? 'USER' : 'ASSISTANT'}
                  <span className="text-gray-500 text-xs ml-2">
                    [{message.timestamp.toLocaleTimeString()}]
                  </span>
                </div>
                <div className="whitespace-pre-wrap pl-4">
                  {message.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="text-yellow-400">
                <div className="font-bold mb-1">&gt; ASSISTANT</div>
                <div className="pl-4">Processing...</div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="border-t border-green-400 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  mode === 'pdf' && !selectedPdf
                    ? "Select a PDF first..."
                    : "Type your message..."
                }
                disabled={isLoading || (mode === 'pdf' && !selectedPdf)}
                className="flex-1 bg-black border border-green-400 text-green-400 px-3 py-2 rounded focus:outline-none focus:border-green-300 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim() || (mode === 'pdf' && !selectedPdf)}
                className="px-6 py-2 bg-green-400 text-black rounded hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'PROCESSING...' : 'SEND'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 