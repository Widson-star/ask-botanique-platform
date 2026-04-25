import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './Nursery.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const COUNTIES = [
  '', 'Nairobi', 'Kiambu', 'Nakuru', 'Mombasa', 'Kisumu', 'Nyeri', 'Machakos', 'Kajiado', 'Meru', 'Uasin Gishu',
]

const SPECIALTIES = [
  { slug: '',            label: 'All specialties' },
  { slug: 'indigenous',  label: 'Indigenous trees' },
  { slug: 'ornamental',  label: 'Ornamentals' },
  { slug: 'fruit',       label: 'Fruit trees' },
  { slug: 'succulents',  label: 'Succulents' },
  { slug: 'cut-flower',  label: 'Cut flowers' },
  { slug: 'hedge',       label: 'Hedging' },
  { slug: 'indoor',      label: 'Indoor plants' },
  { slug: 'medicinal',   label: 'Medicinal' },
  { slug: 'palms',       label: 'Palms' },
  { slug: 'wholesale',   label: 'Wholesale' },
]

interface NurseryCard {
  id: string
  slug: string
  name: string
  description: string | null
  county: string | null
  specialties: string[] | null
  is_verified: boolean
  profile_image_url: string | null
}

export default function Nurseries() {
  const { user } = useAuth()
  const [q, setQ]               = useState('')
  const [county, setCounty]     = useState('')
  const [specialty, setSpec]    = useState('')
  const [items, setItems]       = useState<NurseryCard[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const fetchNurseries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (county) params.set('county', county)
      if (specialty) params.set('specialty', specialty)
      const res = await fetch(`${API_BASE}/api/nurseries?${params}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Could not load nurseries')
      setItems(j.nurseries ?? [])
      setTotal(j.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load.')
    } finally {
      setLoading(false)
    }
  }, [q, county, specialty])

  useEffect(() => {
    const t = setTimeout(fetchNurseries, 280)
    return () => clearTimeout(t)
  }, [fetchNurseries])

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
          <span>Ask Botanique</span>
        </Link>
        <div className={styles.navRight}>
          <Link to="/explore" className={styles.navLink}>Browse plants</Link>
          {user
            ? <Link to="/nursery/dashboard" className={styles.navBtn}>My nursery →</Link>
            : <Link to="/nursery/signup" className={styles.navBtn}>List your nursery</Link>}
        </div>
      </nav>

      {/* Thumbtack-borrowed hero: giant title + single search bar with county selector */}
      <section className={styles.heroWrap}>
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>§ Marketplace</span>
          <h1 className={styles.heroTitle}>Find a nursery near you.</h1>
          <p className={styles.heroLede}>
            Verified East African nurseries — search by plant, specialty or county.
          </p>
          <form
            className={styles.heroSearch}
            onSubmit={e => { e.preventDefault(); fetchNurseries() }}
          >
            <input
              className={styles.heroSearchInput}
              type="text"
              placeholder="Describe what you're looking for — indigenous trees, succulents, cut flowers…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <select
              className={styles.heroCountySelect}
              value={county}
              onChange={e => setCounty(e.target.value)}
            >
              <option value="">All counties</option>
              {COUNTIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className={styles.heroSearchBtn}>Search</button>
          </form>
        </div>
      </section>

      {/* Specialty strip — Thumbtack "category tabs" pattern */}
      <div className={styles.specStrip}>
        {SPECIALTIES.map(s => (
          <button
            key={s.slug}
            className={`${styles.chip} ${specialty === s.slug ? styles.chipActive : ''}`}
            onClick={() => setSpec(s.slug)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <main className={styles.listMain}>
        <div style={{ marginBottom: 18, color: '#6a6a6a', fontSize: '0.9rem' }}>
          {loading ? 'Loading…' : `${total} nurser${total === 1 ? 'y' : 'ies'}`}
        </div>

        {error && <div className={styles.errorBox} style={{ marginBottom: 18 }}>{error}</div>}

        {items.length === 0 && !loading ? (
          <div className={styles.emptyInv}>
            <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--color-primary)' }}>
              No nurseries match these filters.
            </p>
            <p style={{ margin: '0 0 16px' }}>
              We're onboarding nurseries across East Africa. Want to be the first in your county?
            </p>
            <Link to="/nursery/signup" className={styles.submitBtn} style={{ display: 'inline-block', textDecoration: 'none' }}>
              List your nursery →
            </Link>
          </div>
        ) : (
          <div className={styles.nurseryGrid}>
            {items.map(n => (
              <Link key={n.id} to={`/nurseries/${n.slug}`} className={styles.nurseryCard}>
                <div className={styles.nurseryCardHead}>
                  <div>
                    <h3 className={styles.nurseryName}>{n.name}</h3>
                    <div className={styles.nurseryCounty}>{n.county ?? 'Location not set'}</div>
                  </div>
                  {n.is_verified && <span className={styles.verifiedBadge}>✓</span>}
                </div>
                {n.description && <p className={styles.nurseryDesc}>{n.description}</p>}
                {n.specialties?.length ? (
                  <div className={styles.nurserySpecs}>
                    {n.specialties.slice(0, 4).map(s => (
                      <span key={s} className={styles.specTag}>{s}</span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
