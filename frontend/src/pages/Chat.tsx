import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ChatMessage from '../components/ChatMessage'
import type { ChatMessage as ChatMessageType, ChatResponse } from '../types'
import styles from './Chat.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function fetchSpeciesCount(): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/api/stats`)
    if (!res.ok) return null
    const d = await res.json()
    return d?.approved_species_count ?? null
  } catch {
    return null
  }
}

const SUGGESTED_PROMPTS = [
  'What trees grow well in Nairobi with clay soil and 800mm rainfall?',
  'I need a groundcover for full shade and sandy soil near Mombasa.',
  'Which plants are best for a low-maintenance hedge in partial shade?',
  'Recommend drought-tolerant native plants for 500mm rainfall areas.',
]

function generateId() {
  return Math.random().toString(36).slice(2)
}

function greeting(count: number | null) {
  const n = count ? `${count}+` : '600+'
  return `Hello! I'm your Ask Botanique AI assistant. I can help you find the perfect plants for your site conditions across East Africa.\n\nTell me about your site — rainfall, soil type, sunlight, and what you're trying to achieve — and I'll recommend the best options from our database of ${n} species.`
}

export default function Chat() {
  const { user, session, signOut } = useAuth()
  const [messages, setMessages] = useState<ChatMessageType[]>([])

  useEffect(() => {
    fetchSpeciesCount().then(count => {
      setMessages([{ id: generateId(), role: 'assistant', content: greeting(count), timestamp: new Date() }])
    })
  }, [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [input])

  async function send(text: string) {
    if (!text.trim() || loading) return

    const userMsg: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text.trim(), history }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${res.status}`)
      }

      const data: ChatResponse = await res.json()

      const assistantMsg: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: data.reply,
        plants: data.plants,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className={styles.layout}>
      {/* ── SIDEBAR ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link to="/" className={styles.brand}>
            <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
            <span>Ask Botanique</span>
          </Link>

          <button
            className={styles.newChat}
            onClick={() =>
              setMessages([
                {
                  id: generateId(),
                  role: 'assistant',
                  content:
                    'New conversation started. Tell me about your site conditions and I\'ll find the right plants for you.',
                  timestamp: new Date(),
                },
              ])
            }
          >
            + New chat
          </button>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className={styles.userDetails}>
              <p className={styles.userEmail}>{user?.email}</p>
            </div>
          </div>
          <button className={styles.signOutBtn} onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN CHAT AREA ── */}
      <main className={styles.main}>
        {/* Messages */}
        <div className={styles.messages}>
          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {loading && (
            <div className={styles.thinkingRow}>
              <div className={styles.thinkingDot} />
              <div className={styles.thinkingDot} />
              <div className={styles.thinkingDot} />
            </div>
          )}

          {error && (
            <div className={styles.errorBanner}>
              ⚠️ {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts — only show at start */}
        {messages.length === 1 && (
          <div className={styles.suggestions}>
            {SUGGESTED_PROMPTS.map(p => (
              <button
                key={p}
                className={styles.suggestionChip}
                onClick={() => send(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <form className={styles.inputBar} onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            placeholder="Describe your site or ask anything about plants…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            {loading ? <span className="spinner" /> : '↑'}
          </button>
        </form>
        <p className={styles.disclaimer}>
          Ask Botanique may make mistakes. Always verify recommendations with a local horticulturist.
        </p>
      </main>
    </div>
  )
}
