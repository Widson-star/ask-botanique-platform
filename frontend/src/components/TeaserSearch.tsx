import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import styles from './TeaserSearch.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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
  suitability_score: number
  match_reasons: string[]
  warnings: string[]
}

interface ChatResult {
  reply: string
  plants?: PlantResult[]
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

export default function TeaserSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChatResult | null>(null)
  const [error, setError] = useState('')
  const [freeQueryUsed, setFreeQueryUsed] = useState(
    () => localStorage.getItem('ab_free_query_used') === 'true'
  )

  async function runQuery(msg: string) {
    if (!msg.trim()) return

    if (freeQueryUsed) {
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
      localStorage.setItem('ab_free_query_used', 'true')
      setFreeQueryUsed(true)
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

  const showSignupGate = result !== null || freeQueryUsed

  return (
    <div className={styles.teaser}>
      <p className={styles.label}>Try it free — one query, no account needed</p>

      <form className={styles.searchBar} onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. What trees suit clay soil with 900mm rainfall in full sun?"
          className={styles.input}
          disabled={loading}
          aria-label="Plant query"
        />
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading || !query.trim()}
        >
          {loading ? <span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> : 'Ask →'}
        </button>
      </form>

      {!result && !loading && !freeQueryUsed && (
        <div className={styles.examples}>
          {EXAMPLES.map(q => (
            <button key={q} className={styles.exampleBtn} onClick={() => handleExample(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {showSignupGate && (
        <div className={styles.results}>
          {result?.reply && (
            <div className={styles.reply}>
              <span className={styles.replyIcon}>🌿</span>
              <div className={styles.replyText}>
                <ReactMarkdown>{result.reply}</ReactMarkdown>
              </div>
            </div>
          )}

          {result?.plants && result.plants.length > 0 && (
            <div className={styles.plantGrid}>
              {result.plants.slice(0, 3).map((r, i) => (
                <div key={r.plant.id ?? i} className={styles.plantCard}>
                  <div className={styles.plantImage}>
                    {r.plant.thumbnail_url ?? r.plant.image_url ? (
                      <img
                        src={r.plant.thumbnail_url ?? r.plant.image_url}
                        alt={r.plant.scientific_name}
                        loading="lazy"
                      />
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
                      <span
                        className={styles.scoreBadge}
                        style={{ background: scoreColor(r.suitability_score) }}
                      >
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
                    <Link to="/signup" className={styles.unlockBtn}>
                      Unlock full profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.signupPrompt}>
            <p className={styles.promptText}>
              Sign up free to see full plant profiles, save results, and filter by location
            </p>
            <div className={styles.promptActions}>
              <Link to="/signup" className={styles.promptSignupBtn}>Create free account</Link>
              <Link to="/login" className={styles.promptLogin}>Already have an account →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
