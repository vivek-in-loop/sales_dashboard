import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getAuthHeaders } from "../utils/api";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4030/api";

function AIChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load suggestions on mount
  useEffect(() => {
    loadSuggestions();
    // Add welcome message
    setMessages([
      {
        role: "assistant",
        content: "Hello! I'm your AI Database Assistant. I can help you query and analyze your sales dashboard data. Ask me anything about SDRs, emails, opens, clicks, or contacts!",
        timestamp: new Date().toISOString(),
        type: "text"
      }
    ]);
  }, []);

  const loadSuggestions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/ai/suggestions`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to load suggestions:", err);
    }
  };

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim() || loading) return;

    const userMessage = {
      role: "user",
      content: messageText.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: messageText.trim(),
          conversationHistory: messages.slice(-10) // Send last 10 messages for context
        })
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      
      const assistantMessage = {
        role: "assistant",
        content: data.response.message,
        data: data.response.data,
        type: data.response.type,
        count: data.response.count,
        success: data.response.success,
        suggestions: data.response.suggestions,
        timestamp: data.timestamp,
        aiPowered: data.aiPowered
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request. Please try again.",
          type: "error",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (query) => {
    sendMessage(query);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        timestamp: new Date().toISOString(),
        type: "text"
      }
    ]);
    setShowSuggestions(true);
  };

  const renderData = (data, type, message) => {
    if (!data && type !== "architecture") return null;

    // Help with categories
    if (type === "help" && data?.categories) {
      return (
        <div className="mt-3 space-y-4">
          {data.categories.map((cat, idx) => (
            <div key={idx}>
              <p className="text-sm font-semibold text-gray-700 mb-2">{cat.name}</p>
              <div className="flex flex-wrap gap-2">
                {cat.queries.map((query, qIdx) => (
                  <button
                    key={qIdx}
                    onClick={() => handleSuggestionClick(query)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-indigo-100 rounded-full transition text-gray-700 hover:text-indigo-700"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Upload history
    if ((type === "upload_history" || type === "all_upload_history") && data) {
      const history = type === "upload_history" ? data.history : data;
      return (
        <div className="mt-3">
          {data.sdr && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <p className="text-sm"><strong>{data.sdr.name}</strong> ({data.sdr.email})</p>
              {data.sdr.team && <p className="text-xs text-gray-500">Team: {data.sdr.team}</p>}
            </div>
          )}
          {history && history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {type === "all_upload_history" && <th className="px-2 py-1.5 text-left font-medium text-gray-600">SDR</th>}
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">Type</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">Date</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">Total</th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-600">Inserted</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {type === "all_upload_history" && <td className="px-2 py-1.5 text-gray-700">{h.sdr_name}</td>}
                      <td className="px-2 py-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          h.type === 'gmail_send' ? 'bg-blue-100 text-blue-700' : 
                          h.type === 'mailsuite' ? 'bg-purple-100 text-purple-700' : 
                          'bg-green-100 text-green-700'
                        }`}>
                          {h.type === 'gmail_send' ? 'Gmail' : h.type === 'mailsuite' ? 'MailSuite' : 'Contacts'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{h.date}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{h.total?.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-green-600">{h.inserted?.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-gray-500 truncate max-w-[150px]" title={h.filename}>{h.filename || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upload history found.</p>
          )}
        </div>
      );
    }

    // SDR Profile
    if (type === "sdr_profile" && data) {
      return (
        <div className="mt-3">
          {data.upload_history && data.upload_history.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Recent Uploads:</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Type</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Date</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-600">Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.upload_history.map((h, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            h.type === 'gmail_send' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {h.type === 'gmail_send' ? 'Gmail' : 'MailSuite'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-700">{h.date}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{h.total?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Domain search results
    if (type === "domain_search" && data) {
      return (
        <div className="mt-3 space-y-4">
          {/* Gmail Records */}
          {data.gmail?.count > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">📧 Email Sends ({data.gmail.count})</p>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Date</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Recipient</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Subject</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.gmail.records.slice(0, 15).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{r.sent_date || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-700">{r.recipient_email || r.recipient_name}</td>
                        <td className="px-2 py-1.5 text-gray-700 truncate max-w-xs">{r.subject || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* MailSuite Records */}
          {data.mailsuite?.count > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">👁️ Tracking Data ({data.mailsuite.count})</p>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Date</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Recipient</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-600">Opens</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-600">Clicks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.mailsuite.records.slice(0, 15).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{r.sent_date || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-700">{r.recipient_email || r.recipient}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{r.opens || 0}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{r.clicks || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Contacts */}
          {data.contacts?.count > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">📇 Contacts ({data.contacts.count})</p>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Name</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Email</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Company</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Title</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.contacts.records.slice(0, 15).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-700">{r.first_name} {r.last_name}</td>
                        <td className="px-2 py-1.5 text-gray-700">{r.email}</td>
                        <td className="px-2 py-1.5 text-gray-700">{r.company_name || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-700 truncate max-w-xs">{r.title || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Overview with SDRs table
    if (type === "overview" && data?.sdrs) {
      return (
        <div className="mt-3">
          <p className="text-sm font-medium text-gray-700 mb-2">SDR Performance:</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Team</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Gmail</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">MailSuite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.sdrs.map((sdr, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{sdr.name}</td>
                    <td className="px-3 py-2 text-gray-600">{sdr.team}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{sdr.gmail?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{sdr.mailsuite?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Aggregation results
    if (type === "aggregate" && Array.isArray(data)) {
      if (data.length === 0) return <p className="text-sm text-gray-500 mt-2">No results found.</p>;
      
      // Check if it's grouped data
      if (data[0]?._id !== undefined) {
        return (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Group</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Count</th>
                  {data[0].avgOpens !== undefined && <th className="px-3 py-2 text-right font-medium text-gray-600">Avg Opens</th>}
                  {data[0].totalOpens !== undefined && <th className="px-3 py-2 text-right font-medium text-gray-600">Total Opens</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.slice(0, 25).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{row._id || "(empty)"}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.count?.toLocaleString() || "-"}</td>
                    {row.avgOpens !== undefined && <td className="px-3 py-2 text-right text-gray-700">{row.avgOpens?.toFixed(2)}</td>}
                    {row.totalOpens !== undefined && <td className="px-3 py-2 text-right text-gray-700">{row.totalOpens?.toLocaleString()}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    // Generic array data (list of records)
    if (Array.isArray(data) && data.length > 0) {
      const keys = Object.keys(data[0]).filter(k => !k.startsWith("_") && k !== "raw_data" && k !== "__v" && k !== "sdr_id");
      
      return (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {keys.slice(0, 6).map(key => (
                  <th key={key} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                    {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.slice(0, 20).map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {keys.slice(0, 6).map(key => (
                    <td key={key} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate" title={String(row[key] ?? "")}>
                      {typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 20 && (
            <p className="text-xs text-gray-500 mt-2 px-3">Showing 20 of {data.length} results</p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Database Assistant</h1>
              <p className="text-sm text-gray-500">Ask questions about your sales data in natural language</p>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-gray-500">AI Assistant</span>
                    {message.aiPowered && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">AI Powered</span>
                    )}
                  </div>
                )}
                
                <div className={message.role === "user" ? "text-white" : "text-gray-800"}>
                  {message.content.split("\n").map((line, i) => (
                    <p key={i} className={i > 0 ? "mt-1" : ""}>
                      {line.split("**").map((part, j) => (
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                      ))}
                    </p>
                  ))}
                </div>

                {message.role === "assistant" && (message.data || message.type === "architecture") && renderData(message.data, message.type, message.content)}

                {message.role === "assistant" && message.suggestions && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-500">Try these:</p>
                    {message.suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(suggestion.replace("Try: ", "").replace(/'/g, ""))}
                        className="block text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <p className={`text-xs mt-2 ${message.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm font-medium text-gray-600 mb-3">Quick queries:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 3).flatMap(cat => cat.queries.slice(0, 2)).map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(query)}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:bg-indigo-50 transition text-gray-700"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your data... (e.g., 'How many emails were sent?')"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 placeholder-gray-400"
                disabled={loading}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Powered by AI (Claude/GPT-4/Gemini via OpenRouter)
          </p>
        </div>
      </div>
    </div>
  );
}

export default AIChatPage;
