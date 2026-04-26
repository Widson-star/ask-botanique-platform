import { BotaniqueMark } from '../components/BotaniqueMark'
import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const plantParam = searchParams.get('plant')

  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load greeting + pre-fill from ?plant= param
  useEffect(() => {
    fetchSpeciesCount().then(count => {
      setMessages([{
        id: generateId(),
        role: 'assistant',
        content: greeting(count),
        timestamp: new Date(),
      }])
      if (plantParam) {
        setInput(`Tell me about ${plantParam} — is it a good fit for my site?`)
      }
    })
  }, [plantParam])

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

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: data.reply,
        plants: data.plants,
        timestamp: new Date(),
      }])
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

  function resetChat() {
    setMessages([{
      id: generateId(),
      role: 'assistant',
      content: 'New conversation started. Tell me about your site conditions and I\'ll find the right plants for you.',
      timestamp: new Date(),
    }])
    setInput('')
    setError(null)
  }

  return (
    <div className={styles.page}>

      {/* ── TOP NAV ── */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <BotaniqueMark size={28} variant="light" />
          <span>Ask Botanique</span>
        </Link>

        <div className={styles.navCenter}>
          <Link to="/explore" className={styles.navLink}>← Browse plants</Link>
          <button className={styles.newChatBtn} onClick={resetChat}>+ New chat</button>
        </div>

        <div className={styles.navRight}>
          <div className={styles.userAvatar}>{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
          <span className={styles.userEmail}>{user?.email}</span>
          <button className={styles.signOutBtn} onClick={() => signOut()}>Sign out</button>
        </div>
      </nav>

      {/* ── CHAT PANEL ── */}
      <main className={styles.panel}>

        {/* Context banner when arriving from a plant card */}
        {plantParam && messages.length <= 1 && (
          <div className={styles.contextBanner}>
            <span>Asking about <strong>{plantParam}</strong></span>
            <Link to="/explore" className={styles.contextBack}>← Back to explore</Link>
          </div>
        )}

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
            <div className={styles.errorBanner}>⚠️ {error}</div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts — only at conversation start */}
        {messages.length === 1 && !plantParam && (
          <div className={styles.suggestions}>
            {SUGGESTED_PROMPTS.map(p => (
              <button key={p} className={styles.chip} onClick={() => send(p)}>{p}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className={styles.inputWrap}>
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
              aria-label="Send"
            >
              {loading ? '…' : '↑'}
            </button>
          </form>
          <p className={styles.disclaimer}>
            Ask Botanique may make mistakes. Always verify with a local horticulturist.
          </p>
        </div>

      </main>
    </div>
  )
}
