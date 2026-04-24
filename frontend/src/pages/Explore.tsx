import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './Explore.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const LIMIT = 48

const QUICK_TAGS = [
  { slug: 'flowering',       label: 'Flowering' },
  { slug: 'fruit',           label: 'Fruit-bearing' },
  { slug: 'indigenous',      label: 'Indigenous' },
  { slug: 'hedge',           label: 'Hedge' },
  { slug: 'shade',           label: 'Shade' },
  { slug: 'drought-tolerant',label: 'Drought-tolerant' },
  { slug: 'ornamental',      label: 'Ornamental' },
  { slug: 'medicinal',       label: 'Medicinal' },
  { slug: 'edible',          label: 'Edible' },
  { slug: 'climber',         label: 'Climber' },
  { slug: 'tree',            label: 'Tree' },
  { slug: 'shrub',           label: 'Shrub' },
  { slug: 'perennial',       label: 'Perennial' },
  { slug: 'fast-growing',    label: 'Fast-growing' },
  { slug: 'avenue',          label: 'Avenue tree' },
  { slug: 'agroforestry',    label: 'Agroforestry' },
  { slug: 'nitrogen-fixing', label: 'Nitrogen-fixing' },
  { slug: 'invasive',        label: 'Invasive' },
]

const ZONES = [
  { slug: '',          label: 'All zones' },
  { slug: 'highland',  label: 'Highland' },
  { slug: 'coastal',   label: 'Coastal' },
  { slug: 'savanna',   label: 'Savanna' },
  { slug: 'semi-arid', label: 'Semi-arid' },
  { slug: 'arid',      label: 'Arid / ASAL' },
  { slug: 'lakeside',  label: 'Lakeside' },
]

const ORIGINS = [
  { slug: '',            label: 'All origins' },
  { slug: 'indigenous',  label: 'Indigenous' },
  { slug: 'exotic',      label: 'Exotic' },
  { slug: 'naturalised', label: 'Naturalised' },
  { slug: 'invasive',    label: 'Invasive' },
]

interface ExplorePlant {
  id: string
  scientific_name: string
  common_names: string[] | null
  tags: string[] | null
  origin: string | null
  ecological_zone: string | null
  sunlight: string | null
  maintenance_level: string | null
  min_rainfall: number | null
  max_rainfall: number | null
  image_url: string | null
  thumbnail_url: string | null
  description: string | null
}

export default function Explore() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [zone, setZone] = useState('')
  const [origin, setOrigin] = useState('')
  const [plants, setPlants] = useState<ExplorePlant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPlants = useCallback(async (
    currentQ: string,
    currentTags: string[],
    currentZone: string,
    currentOrigin: string,
    newOffset: number,
    replace: boolean
  ) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (currentQ.trim()) params.set('q', currentQ.trim())
    if (currentTags.length) params.set('tags', currentTags.join(','))
    if (currentZone) params.set('ecological_zone', currentZone)
    if (currentOrigin) params.set('origin', currentOrigin)
    params.set('limit', String(LIMIT))
    params.set('offset', String(newOffset))

    try {
      const res = await fetch(`${API_BASE}/api/explore?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setTotal(data.total ?? 0)
      setPlants(prev => replace ? (data.plants ?? []) : [...prev, ...(data.plants ?? [])])
      setOffset(newOffset)
    } catch {
      if (replace) setPlants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = q ? 350 : 0
    debounceRef.current = setTimeout(() => {
      fetchPlants(q, selectedTags, zone, origin, 0, true)
    }, delay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, selectedTags, zone, origin, fetchPlants])

  function toggleTag(slug: string) {
    setSelectedTags(prev =>
      prev.includes(slug) ? prev.filter(t => t !== slug) : [...prev, slug]
    )
  }

  function clearAll() {
    setQ('')
    setSelectedTags([])
    setZone('')
    setOrigin('')
  }

  const hasFilters = !!(q || selectedTags.length || zone || origin)

  return (
    <div className={styles.page}>
      {/* NAV */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
          <span>Ask Botanique</span>
        </Link>
        <div className={styles.navRight}>
          {user ? (
            <Link to="/chat" className={styles.chatBtn}>Open Chat →</Link>
          ) : (
            <>
              <Link to="/login" className={styles.loginLink}>Sign in</Link>
              <Link to="/signup" className={styles.signupBtn}>Get started free</Link>
            </>
          )}
        </div>
      </nav>

      {/* STICKY FILTER BAR */}
      <div className={styles.filterBar}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search plants — try 'flowering', 'fruit', 'wild', 'hedge', 'perennial'…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button className={styles.clearInput} onClick={() => setQ('')} aria-label="Clear search">×</button>
          )}
        </div>

        {/* Quick tag chips */}
        <div className={styles.chipScroll}>
          <div className={styles.chipRow}>
            {QUICK_TAGS.map(t => (
              <button
                key={t.slug}
                className={`${styles.chip} ${selectedTags.includes(t.slug) ? styles.chipActive : ''}`}
                onClick={() => toggleTag(t.slug)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zone + Origin pills */}
        <div className={styles.pillSection}>
          <div className={styles.pillGroup}>
            <span className={styles.pillLabel}>Zone</span>
            <div className={styles.pillRow}>
              {ZONES.map(z => (
                <button
                  key={z.slug}
                  className={`${styles.pill} ${zone === z.slug ? styles.pillActive : ''}`}
                  onClick={() => setZone(z.slug)}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.pillGroup}>
            <span className={styles.pillLabel}>Origin</span>
            <div className={styles.pillRow}>
              {ORIGINS.map(o => (
                <button
                  key={o.slug}
                  className={`${styles.pill} ${origin === o.slug ? styles.pillActive : ''}`}
                  onClick={() => setOrigin(o.slug)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results meta */}
        <div className={styles.resultsMeta}>
          <span className={styles.resultsCount}>
            {loading && plants.length === 0
              ? 'Loading…'
              : `${total.toLocaleString()} plant${total !== 1 ? 's' : ''}`}
          </span>
          {hasFilters && (
            <button className={styles.clearAll} onClick={clearAll}>Clear all filters ×</button>
          )}
        </div>
      </div>

      {/* GRID */}
      <main className={styles.main}>
        <div className={styles.grid}>
          {loading && plants.length === 0
            ? Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={styles.skeleton} />
              ))
            : plants.map(p => (
                <PlantCard key={p.id} plant={p} showChatLink={!!user} />
              ))
          }
        </div>

        {!loading && plants.length === 0 && (
          <div className={styles.empty}>
            <p>No plants match these filters.</p>
            {hasFilters && (
              <button className={styles.emptyAction} onClick={clearAll}>Clear all filters</button>
            )}
          </div>
        )}

        {/* Load more */}
        {!loading && plants.length < total && plants.length > 0 && (
          <div className={styles.loadMore}>
            <button
              className={styles.loadMoreBtn}
              onClick={() => fetchPlants(q, selectedTags, zone, origin, offset + LIMIT, false)}
            >
              Load more
            </button>
            <span className={styles.loadMoreMeta}>{plants.length} of {total.toLocaleString()}</span>
          </div>
        )}

        {loading && plants.length > 0 && (
          <p className={styles.loadingMore}>Loading more…</p>
        )}
      </main>

      <footer className={styles.footer}>
        <p>Ask Botanique may make mistakes. Always verify recommendations with a local horticulturist.</p>
      </footer>
    </div>
  )
}

function PlantCard({ plant, showChatLink }: { plant: ExplorePlant; showChatLink: boolean }) {
  const primaryName = plant.common_names?.[0] ?? plant.scientific_name
  const displayTags = (plant.tags ?? []).slice(0, 3)
  const rainfall =
    plant.min_rainfall && plant.max_rainfall
      ? `${plant.min_rainfall}–${plant.max_rainfall} mm`
      : plant.min_rainfall
      ? `${plant.min_rainfall}+ mm`
      : null

  return (
    <article className={styles.card}>
      <div className={styles.cardImg}>
        {plant.thumbnail_url || plant.image_url ? (
          <img
            src={plant.thumbnail_url ?? plant.image_url!}
            alt={primaryName}
            loading="lazy"
          />
        ) : (
          <div className={styles.cardImgPlaceholder}>
            <svg viewBox="0 0 48 48" fill="none">
              <path d="M24 38V16M16 24c2-6 8-10 8-10s6 4 8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M24 28c-3 0-7-2-9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {plant.ecological_zone && plant.ecological_zone !== 'general' && (
          <span className={styles.zoneBadge}>{plant.ecological_zone}</span>
        )}
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardName}>{primaryName}</p>
        <p className={styles.cardSci}>{plant.scientific_name}</p>

        {displayTags.length > 0 && (
          <div className={styles.cardTags}>
            {displayTags.map(t => (
              <span key={t} className={styles.cardTag}>{t}</span>
            ))}
          </div>
        )}

        <div className={styles.cardMeta}>
          {plant.origin && (
            <span className={`${styles.metaPill} ${styles[`origin_${plant.origin}`] ?? ''}`}>
              {plant.origin}
            </span>
          )}
          {rainfall && <span className={styles.metaRain}>☁ {rainfall}</span>}
        </div>

        {showChatLink && (
          <Link
            to={`/chat?plant=${encodeURIComponent(plant.scientific_name)}`}
            className={styles.cardChatLink}
          >
            Ask about this →
          </Link>
        )}
      </div>
    </article>
  )
}
