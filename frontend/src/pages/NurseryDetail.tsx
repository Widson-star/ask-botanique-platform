import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import styles from './Nursery.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface NurseryDetail {
  id: string
  slug: string
  name: string
  description: string | null
  county: string | null
  address: string | null
  specialties: string[] | null
  delivery_counties: string[] | null
  min_order_kes: number | null
  is_verified: boolean
  profile_image_url: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
}

interface InventoryItem {
  id: string
  quantity_available: number
  price_kes: number | null
  price_unit: string
  container_size: string | null
  is_available: boolean
  lead_time_days: number | null
  seasonal_note: string | null
  plants: {
    id: string
    scientific_name: string
    common_names: string[] | null
    tags: string[] | null
    image_url: string | null
    thumbnail_url: string | null
    ecological_zone: string | null
    origin: string | null
  } | null
}

export default function NurseryDetail() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [nursery, setNursery]     = useState<NurseryDetail | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/nurseries/${encodeURIComponent(slug)}`)
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error || 'Could not load nursery.')
        if (cancelled) return
        setNursery(j.nursery)
        setInventory(j.inventory ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load nursery.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  if (loading) return <div className={styles.loadingPage}>Loading…</div>
  if (error || !nursery) {
    return (
      <div className={styles.page}>
        <nav className={styles.nav}>
          <Link to="/" className={styles.brand}>
            <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
            <span>Ask Botanique</span>
          </Link>
          <div className={styles.navRight}>
            <Link to="/nurseries" className={styles.navLink}>← All nurseries</Link>
          </div>
        </nav>
        <main className={styles.listMain}>
          <div className={styles.emptyInv}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-primary)' }}>
              {error || 'Nursery not found.'}
            </p>
          </div>
        </main>
      </div>
    )
  }

  const waLink = nursery.whatsapp
    ? `https://wa.me/${nursery.whatsapp.replace(/[^0-9]/g, '')}`
    : null

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
          <span>Ask Botanique</span>
        </Link>
        <div className={styles.navRight}>
          <Link to="/nurseries" className={styles.navLink}>← All nurseries</Link>
          <Link to="/explore" className={styles.navLink}>Browse plants</Link>
        </div>
      </nav>

      <section className={styles.heroWrap} style={{ paddingTop: 48, paddingBottom: 36 }}>
        <div className={styles.heroInner} style={{ textAlign: 'left' }}>
          <span className={styles.heroEyebrow}>
            {nursery.county ? `§ ${nursery.county}` : '§ Nursery'}
          </span>
          <h1 className={styles.heroTitle} style={{ fontSize: '2.25rem' }}>
            {nursery.name}
            {nursery.is_verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
          </h1>
          {nursery.description && (
            <p className={styles.heroLede} style={{ maxWidth: 700 }}>{nursery.description}</p>
          )}

          {/* Contact strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer" className={styles.submitBtn} style={{ textDecoration: 'none' }}>
                WhatsApp
              </a>
            )}
            {nursery.phone && (
              <a href={`tel:${nursery.phone}`} className={styles.miniBtn} style={{ padding: '10px 18px', textDecoration: 'none' }}>
                {nursery.phone}
              </a>
            )}
            {nursery.email && (
              <a href={`mailto:${nursery.email}`} className={styles.miniBtn} style={{ padding: '10px 18px', textDecoration: 'none' }}>
                {nursery.email}
              </a>
            )}
            {nursery.website && (
              <a href={nursery.website} target="_blank" rel="noreferrer" className={styles.miniBtn} style={{ padding: '10px 18px', textDecoration: 'none' }}>
                Website ↗
              </a>
            )}
          </div>

          {/* Meta strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 18, fontSize: '0.875rem', color: '#4a4a4a' }}>
            {nursery.address && <span>📍 {nursery.address}</span>}
            {typeof nursery.min_order_kes === 'number' && (
              <span>Min. order KES {nursery.min_order_kes.toLocaleString()}</span>
            )}
            {nursery.delivery_counties?.length ? (
              <span>Delivers to {nursery.delivery_counties.length} counties</span>
            ) : null}
          </div>

          {nursery.specialties?.length ? (
            <div className={styles.nurserySpecs} style={{ marginTop: 18 }}>
              {nursery.specialties.map(s => <span key={s} className={styles.specTag}>{s}</span>)}
            </div>
          ) : null}
        </div>
      </section>

      <main className={styles.listMain}>
        <h2 style={{
          fontFamily: 'Quicksand, sans-serif',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--color-primary)',
          margin: '0 0 18px',
        }}>
          Available plants ({inventory.length})
        </h2>

        {inventory.length === 0 ? (
          <div className={styles.emptyInv}>
            <p style={{ margin: 0 }}>This nursery hasn't listed any plants yet.</p>
          </div>
        ) : (
          <div className={styles.nurseryGrid}>
            {inventory.map(it => (
              <div key={it.id} className={styles.nurseryCard} style={{ cursor: 'default' }}>
                <div className={styles.nurseryCardHead}>
                  <div>
                    <h3 className={styles.nurseryName} style={{ fontStyle: 'italic' }}>
                      {it.plants?.scientific_name ?? '—'}
                    </h3>
                    {it.plants?.common_names?.length ? (
                      <div className={styles.nurseryCounty}>
                        {it.plants.common_names.slice(0, 2).join(', ')}
                      </div>
                    ) : null}
                  </div>
                  {it.price_kes ? (
                    <span style={{
                      background: 'var(--color-primary)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      KES {it.price_kes.toLocaleString()}/{it.price_unit.replace('_', ' ')}
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6a6a6a' }}>
                  {it.container_size ? `${it.container_size} · ` : ''}
                  {it.quantity_available > 0
                    ? `${it.quantity_available} in stock`
                    : (it.lead_time_days ? `Lead time ${it.lead_time_days} days` : 'Made to order')}
                </div>
                {it.seasonal_note && (
                  <div style={{ fontSize: '0.75rem', color: '#8a5a00', fontStyle: 'italic' }}>{it.seasonal_note}</div>
                )}
                {it.plants?.tags?.length ? (
                  <div className={styles.nurserySpecs}>
                    {it.plants.tags.slice(0, 3).map(t => <span key={t} className={styles.specTag}>{t}</span>)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
