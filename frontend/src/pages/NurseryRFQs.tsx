import { BotaniqueMark } from '../components/BotaniqueMark'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './RFQ.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface NurseryRFQRow {
  id: string  // response id
  status: string
  total_quoted_kes: number | null
  valid_until: string | null
  rfq_requests: {
    id: string
    project_name: string
    delivery_county: string
    delivery_date: string | null
    total_budget_kes: number | null
    status: string
    created_at: string
    rfq_items: {
      id: string
      plant_id: string
      quantity: number
      plants: { scientific_name: string; common_names: string[] | null } | null
    }[]
  } | null
}

function formatKes(amount: number | null) {
  if (!amount) return '—'
  return `KES ${amount.toLocaleString()}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NurseryRFQs() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [, setToken] = useState<string | null>(null)
  const [nursery, setNursery] = useState<{ id: string; name: string } | null>(null)
  const [rfqs, setRfqs] = useState<NurseryRFQRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?next=/nursery/rfq'); return }
    let cancelled = false

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const t = session?.access_token ?? null
        if (!t) throw new Error('Not signed in.')
        if (cancelled) return
        setToken(t)

        const res = await fetch(`${API_BASE}/api/nursery/rfq`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error || 'Could not load RFQs.')
        if (cancelled) return
        setNursery(j.nursery)
        setRfqs(j.rfqs ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unexpected error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, user, navigate])

  if (authLoading || loading) {
    return <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center' }}>Loading…</div>
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <BotaniqueMark size={28} variant="light" />
          <span>Ask Botanique</span>
        </Link>
        <div className={styles.navRight}>
          <Link to="/nursery/dashboard" className={styles.navLink}>Inventory</Link>
          <Link to="/nursery/rfq" className={styles.navLink} style={{ color: '#fff', fontWeight: 700 }}>Incoming RFQs</Link>
        </div>
      </nav>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Incoming Quote Requests</h1>
        <p className={styles.pageSubtitle}>
          {nursery ? `Quote requests sent to ${nursery.name}.` : 'Quote requests for your nursery.'}
        </p>

        {error && <div className={styles.errorBox} style={{ marginBottom: 16 }}>{error}</div>}

        {rfqs.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No quote requests yet</h3>
            <p>
              When a landscaper requests a quote and invites your nursery, it will appear here.
              Make sure your inventory is up to date and your nursery is verified to attract more requests.
            </p>
            <Link to="/nursery/dashboard" className={styles.ctaBtn}>Manage inventory</Link>
          </div>
        ) : (
          <div className={styles.rfqList}>
            {rfqs.map(row => {
              const rfq = row.rfq_requests
              if (!rfq) return null
              const statusKey = row.status === 'pending' ? 'sent' : row.status

              return (
                <Link key={row.id} to={`/rfq/${rfq.id}`} className={styles.rfqCard}>
                  <div className={styles.rfqCardHead}>
                    <div>
                      <h3 className={styles.rfqCardTitle}>{rfq.project_name}</h3>
                      <p className={styles.rfqCardMeta}>
                        <span>{rfq.delivery_county}</span>
                        <span>{rfq.rfq_items.length} {rfq.rfq_items.length === 1 ? 'plant' : 'plants'}</span>
                        {rfq.total_budget_kes && <span>Budget: {formatKes(rfq.total_budget_kes)}</span>}
                        {rfq.delivery_date && <span>By {formatDate(rfq.delivery_date)}</span>}
                        <span style={{ color: '#9ca3af' }}>Received {formatDate(rfq.created_at)}</span>
                      </p>
                    </div>
                    <span className={`${styles.badge} ${styles[`badge-${statusKey}`] ?? ''}`}>
                      {row.status === 'pending' ? 'Awaiting your quote' : row.status}
                    </span>
                  </div>

                  <div className={styles.rfqQuoteLine}>
                    {rfq.rfq_items.slice(0, 3).map(it => (
                      <span key={it.id} style={{ marginRight: 14 }}>
                        {it.quantity} × {it.plants?.scientific_name ?? it.plant_id}
                      </span>
                    ))}
                    {rfq.rfq_items.length > 3 && <span>… +{rfq.rfq_items.length - 3} more</span>}
                  </div>

                  {row.status === 'quoted' && row.total_quoted_kes && (
                    <div className={styles.rfqQuoteLine} style={{ color: '#854d0e', fontWeight: 600, marginTop: 8 }}>
                      Your quote: {formatKes(row.total_quoted_kes)}
                    </div>
                  )}
                  {row.status === 'accepted' && (
                    <div className={styles.rfqQuoteLine} style={{ color: '#15803d', fontWeight: 600, marginTop: 8 }}>
                      Accepted — contact client to arrange delivery
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
