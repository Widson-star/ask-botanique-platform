import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import styles from './TeaserSearch.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const MAX_FREE_QUERIES = 5

interface PlantResult {
  plant: {
    id: string
    scientific_name: string
    common_names: string[]
    category: string
    description: string
    image_url?: string
    thumbnail_url?: string
    water_needs: string
    sunlight: string
    maintenance_level: string
  }
  suitability_score: number | null
  match_reasons: string[]
  warnings: string[]
}

interface ChatResult {
  reply: string
  plants?: PlantResult[]
}

export interface TeaserSearchHandle {
  prefill: (q: string) => void
  focus: () => void
}

interface Props {
  initialQuery?: string
}

const EXAMPLES = [
  'What groundcovers suit clay soil with partial shade in Nairobi?',
  'Drought-tolerant trees for a Mombasa coastal garden with 600mm rainfall',
  'Fast-growing hedges for full sun, loam soil, 900mm annual rainfall',
]

function scoreColor(score: number): string {
  if (score >= 80) return '#1a5d5d'
  if (score >= 60) return '#3E9B9B'
  if (score >= 40) return '#f59e0b'
  return '#dc2626'
}

function getQueriesUsed(): number {
  // migrate old boolean key to counter
  if (localStorage.getItem('ab_free_query_used') === 'true' && !localStorage.getItem('ab_queries_used')) {
    localStorage.setItem('ab_queries_used', '1')
    localStorage.removeItem('ab_free_query_used')
  }
  return parseInt(localStorage.getItem('ab_queries_used') ?? '0', 10)
}

const TeaserSearch = forwardRef<TeaserSearchHandle, Props>(({ initialQuery = '' }, ref) => {
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChatResult | null>(null)
  const [error, setError] = useState('')
  const [queriesUsed, setQueriesUsed] = useState(getQueriesUsed)
  const inputRef = useRef<HTMLInputElement>(null)

  const remaining = MAX_FREE_QUERIES - queriesUsed
  const isGated = remaining <= 0

  useImperativeHandle(ref, () => ({
    prefill(q: string) {
      setQuery(q)
      setResult(null)
      setError('')
    },
    focus() {
      inputRef.current?.focus()
    },
  }))

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery)
  }, [initialQuery])

  async function runQuery(msg: string) {
    if (!msg.trim()) return

    if (isGated) {
      setResult({ reply: '', plants: [] })
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: [] }),
      })
      if (!res.ok) throw new Error('Request failed')
      const data: ChatResult = await res.json()
      setResult(data)
      const newCount = queriesUsed + 1
      localStorage.setItem('ab_queries_used', String(newCount))
      setQueriesUsed(newCount)
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    runQuery(query)
  }

  function handleExample(q: string) {
    setQuery(q)
    runQuery(q)
  }

  return (
    <div className={styles.teaser}>

      {/* Query counter */}
      {!isGated && (
        <div className={styles.counterRow}>
          <div className={styles.counterDots}>
            {Array.from({ length: MAX_FREE_QUERIES }).map((_, i) => (
              <span
                key={i}
                className={`${styles.counterDot} ${i < remaining ? styles.counterDotFull : styles.counterDotEmpty}`}
              />
            ))}
          </div>
          <span className={styles.counterLabel}>
            {remaining === MAX_FREE_QUERIES
              ? `${MAX_FREE_QUERIES} free queries — no account needed`
              : `${remaining} of ${MAX_FREE_QUERIES} queries remaining`}
          </span>
        </div>
      )}

      <form className={styles.searchBar} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. What trees suit clay soil with 900mm rainfall in full sun?"
          className={styles.input}
          disabled={loading || isGated}
          aria-label="Plant query"
        />
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading || !query.trim() || isGated}
        >
          {loading ? <span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> : 'Ask →'}
        </button>
      </form>

      {!result && !loading && !isGated && (
        <div className={styles.examples}>
          {EXAMPLES.map(q => (
            <button key={q} className={styles.exampleBtn} onClick={() => handleExample(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {/* Results */}
      {result && !isGated && (
        <div className={styles.results}>
          {result.reply && (
            <div className={styles.reply}>
              <span className={styles.replyIcon}>🌿</span>
              <div className={styles.replyText}>
                <ReactMarkdown>{result.reply}</ReactMarkdown>
              </div>
            </div>
          )}

          {result.plants && result.plants.length > 0 && (
            <div className={styles.plantGrid}>
              {result.plants.slice(0, 3).map((r, i) => (
                <div key={r.plant.id ?? i} className={styles.plantCard}>
                  <div className={styles.plantImage}>
                    {r.plant.thumbnail_url ?? r.plant.image_url ? (
                      <img src={r.plant.thumbnail_url ?? r.plant.image_url} alt={r.plant.scientific_name} loading="lazy" />
                    ) : (
                      <div className={styles.plantPlaceholder}>🌱</div>
                    )}
                  </div>

                  <div className={styles.plantHeader}>
                    <div>
                      <p className={styles.plantSci}>{r.plant.scientific_name}</p>
                      <p className={styles.plantCommon}>{r.plant.common_names?.[0]}</p>
                    </div>
                    {r.suitability_score !== null && (
                      <span className={styles.scoreBadge} style={{ background: scoreColor(r.suitability_score) }}>
                        {r.suitability_score}/100
                      </span>
                    )}
                  </div>

                  <div className={styles.plantDetails}>
                    <p className={styles.plantDesc}>{r.plant.description ?? 'Suitable for East African conditions.'}</p>
                    <div className={styles.plantMeta}>
                      <span>Water: {r.plant.water_needs}</span>
                      <span>Sun: {r.plant.sunlight}</span>
                    </div>
                  </div>

                  <div className={styles.blurOverlay}>
                    <Link to="/signup" className={styles.unlockBtn}>Unlock full profile</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Signup gate — shown when queries exhausted */}
      {(isGated || (remaining <= 2 && remaining > 0 && result !== null)) && (
        <div className={styles.signupPrompt}>
          {isGated ? (
            <p className={styles.promptText}>
              You've used all {MAX_FREE_QUERIES} free queries. Sign up free to unlock unlimited searches, full plant profiles, and saved results.
            </p>
          ) : (
            <p className={styles.promptText}>
              {remaining} {remaining === 1 ? 'query' : 'queries'} left on your free trial. Sign up to keep going — it's free.
            </p>
          )}
          <div className={styles.promptActions}>
            <Link to="/signup" className={styles.promptSignupBtn}>Create free account</Link>
            <Link to="/login" className={styles.promptLogin}>Already have an account →</Link>
          </div>
        </div>
      )}
    </div>
  )
})

TeaserSearch.displayName = 'TeaserSearch'
export default TeaserSearch
