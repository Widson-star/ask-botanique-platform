import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './RFQ.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface RFQSummary {
  id: string
  project_name: string
  delivery_county: string
  delivery_date: string | null
  total_budget_kes: number | null
  status: string
  created_at: string
  rfq_items: { id: string }[]
  rfq_responses: {
    id: string
    status: string
    total_quoted_kes: number | null
    nursery_id: string
    nurseries: { name: string; slug: string } | null
  }[]
}

function statusBadge(status: string) {
  return <span className={`${styles.badge} ${styles[`badge-${status}`] ?? ''}`}>{status}</span>
}

function formatKes(amount: number | null) {
  if (!amount) return '—'
  return `KES ${amount.toLocaleString()}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RFQList() {
  const { user, loading: authLoading } = useAuth()

  const [token, setToken] = useState<string | null>(null)
  const [rfqs, setRfqs] = useState<RFQSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
  }, [user])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/rfq`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => {
        if (j.error) throw new Error(j.error)
        setRfqs(j.rfqs ?? [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  if (authLoading) {
    return <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center' }}>Loading…</div>
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <Nav />
        <main className={styles.main}>
          <div className={styles.emptyState}>
            <h3>Sign in to view your quotes</h3>
            <p>Create an account to shortlist plants and request quotes from nurseries.</p>
            <Link to="/signup" className={styles.ctaBtn}>Create account</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Nav />
      <main className={styles.main}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 className={styles.pageTitle}>My Quotes</h1>
            <p className={styles.pageSubtitle} style={{ marginBottom: 0 }}>Track quote requests and nursery responses.</p>
          </div>
          <Link to="/rfq/new" className={styles.submitBtn} style={{ textDecoration: 'none', padding: '10px 22px', fontSize: '0.9rem' }}>
            + New request
          </Link>
        </div>

        {error && <div className={styles.errorBox} style={{ marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <p style={{ color: '#6a6a6a', fontSize: '0.9rem' }}>Loading…</p>
        ) : rfqs.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No quote requests yet</h3>
            <p>Shortlist plants from the explore page, then submit a request to nurseries.</p>
            <Link to="/explore" className={styles.ctaBtn}>Browse plants</Link>
          </div>
        ) : (
          <div className={styles.rfqList}>
            {rfqs.map(rfq => {
              const quotedCount = rfq.rfq_responses.filter(r => r.status === 'quoted' || r.status === 'accepted').length
              const acceptedResponse = rfq.rfq_responses.find(r => r.status === 'accepted')

              return (
                <Link key={rfq.id} to={`/rfq/${rfq.id}`} className={styles.rfqCard}>
                  <div className={styles.rfqCardHead}>
                    <div>
                      <h3 className={styles.rfqCardTitle}>{rfq.project_name}</h3>
                      <p className={styles.rfqCardMeta}>
                        <span>{rfq.delivery_county}</span>
                        <span>{rfq.rfq_items.length} {rfq.rfq_items.length === 1 ? 'plant' : 'plants'}</span>
                        {rfq.total_budget_kes && <span>Budget: {formatKes(rfq.total_budget_kes)}</span>}
                        {rfq.delivery_date && <span>By {formatDate(rfq.delivery_date)}</span>}
                        <span style={{ color: '#9ca3af' }}>Submitted {formatDate(rfq.created_at)}</span>
                      </p>
                    </div>
                    {statusBadge(rfq.status)}
                  </div>

                  <div className={styles.rfqQuoteLine}>
                    {rfq.rfq_responses.length === 0 && 'No responses yet — nurseries will respond shortly.'}
                    {quotedCount > 0 && !acceptedResponse && (
                      <span style={{ color: '#854d0e', fontWeight: 600 }}>
                        {quotedCount} {quotedCount === 1 ? 'quote' : 'quotes'} received — review and accept one
                      </span>
                    )}
                    {acceptedResponse && (
                      <span style={{ color: '#15803d', fontWeight: 600 }}>
                        Accepted: {acceptedResponse.nurseries?.name ?? 'Nursery'} — {formatKes(acceptedResponse.total_quoted_kes)}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function Nav() {
  const { user } = useAuth()
  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
        <span>Ask Botanique</span>
      </Link>
      <div className={styles.navRight}>
        <Link to="/explore" className={styles.navLink}>Browse plants</Link>
        {user
          ? <Link to="/rfq/new" className={styles.navBtn}>+ New request</Link>
          : <Link to="/login" className={styles.navBtn}>Sign in</Link>}
      </div>
    </nav>
  )
}
