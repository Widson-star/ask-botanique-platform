import { BotaniqueMark } from '../components/BotaniqueMark'
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './RFQ.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface RFQItem {
  id: string
  plant_id: string
  quantity: number
  price_unit: string | null
  notes: string | null
  plants: {
    id: string
    scientific_name: string
    common_names: string[] | null
    thumbnail_url: string | null
  } | null
}

interface ResponseItem {
  id: string
  plant_id: string
  quantity_available: number | null
  unit_price_kes: number
  container_size: string | null
  notes: string | null
}

interface NurseryResponse {
  id: string
  status: string
  total_quoted_kes: number | null
  valid_until: string | null
  delivery_lead_days: number | null
  notes: string | null
  nursery_id: string
  nurseries: {
    id: string
    name: string
    slug: string
    county: string | null
    is_verified: boolean
  } | null
  rfq_response_items: ResponseItem[]
}

interface RFQDetail {
  id: string
  project_name: string
  delivery_county: string
  delivery_date: string | null
  total_budget_kes: number | null
  status: string
  notes: string | null
  created_at: string
  requester_user_id: string
  rfq_items: RFQItem[]
  rfq_responses: NurseryResponse[]
}

function formatKes(amount: number | null) {
  if (!amount) return '—'
  return `KES ${amount.toLocaleString()}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RFQDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()

  const [token, setToken] = useState<string | null>(null)
  const [rfq, setRfq] = useState<RFQDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Nursery respond form state
  const [nursery, setNursery] = useState<{ id: string; name: string } | null>(null)
  const [respondMode, setRespondMode] = useState(false)
  const [totalQuoted, setTotalQuoted] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [leadDays, setLeadDays] = useState('')
  const [respondNotes, setRespondNotes] = useState('')
  const [responseItems, setResponseItems] = useState<Record<string, { qty: string; price: string; size: string }>>({})
  const [responding, setResponding] = useState(false)
  const [respondError, setRespondError] = useState<string | null>(null)

  // Action state
  const [actioning, setActioning] = useState<string | null>(null)

  // Invite state
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState<Array<{ id: string; name: string; slug: string; county: string | null; is_verified: boolean }>>([])
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
  }, [user])

  // Fetch nursery for current user (to show nursery respond form)
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/api/nursery/rfq`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => {
        if (j.nursery) setNursery(j.nursery)
      })
      .catch(() => { /* not a nursery owner */ })
  }, [token])

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/rfq/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => {
        if (j.error) throw new Error(j.error)
        setRfq(j.rfq)
        // Pre-populate response item fields
        const init: Record<string, { qty: string; price: string; size: string }> = {}
        j.rfq.rfq_items?.forEach((item: RFQItem) => {
          init[item.plant_id] = { qty: String(item.quantity), price: '', size: '' }
        })
        setResponseItems(init)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token, id])

  // Search nurseries (by name or county)
  useEffect(() => {
    if (!rfq) return
    setInviteLoading(true)
    const params = new URLSearchParams()
    if (inviteSearch.trim()) params.set('q', inviteSearch.trim())
    else if (rfq.delivery_county) params.set('county', rfq.delivery_county)
    fetch(`${API_BASE}/api/nurseries?${params}`)
      .then(r => r.json())
      .then(j => setInviteResults(j.nurseries ?? []))
      .catch(() => setInviteResults([]))
      .finally(() => setInviteLoading(false))
  }, [inviteSearch, rfq])

  async function inviteNursery(nurseryId: string) {
    if (!token || !id) return
    setInviting(nurseryId)
    setInviteError(null)
    try {
      const res = await fetch(`${API_BASE}/api/nursery/rfq/${id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nursery_id: nurseryId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Invite failed.')

      // Refresh RFQ
      const refreshed = await fetch(`${API_BASE}/api/rfq/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const rj = await refreshed.json()
      if (!rj.error) setRfq(rj.rfq)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed.')
    } finally {
      setInviting(null)
    }
  }

  async function handleAction(responseId: string, action: 'accept' | 'decline') {
    if (!token) return
    setActioning(responseId + action)
    try {
      const res = await fetch(`${API_BASE}/api/rfq/responses/${responseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Action failed.')

      // Refresh RFQ
      const refreshed = await fetch(`${API_BASE}/api/rfq/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const rj = await refreshed.json()
      if (!rj.error) setRfq(rj.rfq)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setActioning(null)
    }
  }

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !nursery) return
    if (!totalQuoted || isNaN(Number(totalQuoted))) {
      setRespondError('Total quoted amount is required.')
      return
    }

    setResponding(true)
    setRespondError(null)

    const respItems = rfq?.rfq_items.map(item => {
      const ri = responseItems[item.plant_id]
      return {
        plant_id: item.plant_id,
        quantity_available: ri?.qty ? parseInt(ri.qty, 10) : item.quantity,
        unit_price_kes: ri?.price ? Number(ri.price) : 0,
        container_size: ri?.size || null,
      }
    }).filter(it => it.unit_price_kes > 0) ?? []

    try {
      const res = await fetch(`${API_BASE}/api/rfq/${id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          total_quoted_kes: Number(totalQuoted),
          valid_until: validUntil || null,
          delivery_lead_days: leadDays ? parseInt(leadDays, 10) : null,
          notes: respondNotes.trim() || null,
          response_items: respItems,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to submit response.')

      setRespondMode(false)
      // Refresh
      const refreshed = await fetch(`${API_BASE}/api/rfq/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const rj = await refreshed.json()
      if (!rj.error) setRfq(rj.rfq)
    } catch (err) {
      setRespondError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setResponding(false)
    }
  }

  if (authLoading || loading) {
    return <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center' }}>Loading…</div>
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <Nav />
        <main className={styles.main}>
          <div className={styles.emptyState}>
            <h3>Sign in to view this RFQ</h3>
            <Link to="/login" className={styles.ctaBtn}>Sign in</Link>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Nav />
        <main className={styles.main}>
          <Link to="/rfq/my" className={styles.backLink}>← My quotes</Link>
          <div className={styles.errorBox}>{error}</div>
        </main>
      </div>
    )
  }

  if (!rfq) return null

  const isRequester = rfq.requester_user_id === user.id
  const myNurseryResponse = rfq.rfq_responses.find(r => r.nursery_id === nursery?.id)
  const quotedResponses = rfq.rfq_responses.filter(r => r.status === 'quoted' || r.status === 'accepted' || r.status === 'declined')

  return (
    <div className={styles.page}>
      <Nav />
      <main className={styles.main}>
        <Link to="/rfq/my" className={styles.backLink}>← My quotes</Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 className={styles.pageTitle}>{rfq.project_name}</h1>
            <p className={styles.pageSubtitle} style={{ marginBottom: 0 }}>
              Submitted {formatDate(rfq.created_at)}
            </p>
          </div>
          <span className={`${styles.badge} ${styles[`badge-${rfq.status}`] ?? ''}`} style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
            {rfq.status}
          </span>
        </div>

        {/* Project info */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Project details</h2>
          <div className={styles.infoGrid}>
            <div>
              <div className={styles.infoLabel}>Delivery county</div>
              <div className={styles.infoValue}>{rfq.delivery_county}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Required by</div>
              <div className={styles.infoValue}>{formatDate(rfq.delivery_date)}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Budget</div>
              <div className={styles.infoValue}>{formatKes(rfq.total_budget_kes)}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Items</div>
              <div className={styles.infoValue}>{rfq.rfq_items.length} plants</div>
            </div>
          </div>
          {rfq.notes && (
            <div style={{ marginTop: 14, fontSize: '0.9rem', color: '#4b5563', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
              {rfq.notes}
            </div>
          )}
        </div>

        {/* Line items */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Plants requested</h2>
          <table className={styles.shortlistTable}>
            <thead>
              <tr>
                <th>Plant</th>
                <th>Qty</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {rfq.rfq_items.map(item => (
                <tr key={item.id}>
                  <td>
                    <span className={styles.plantName}>{item.plants?.scientific_name ?? item.plant_id}</span>
                    {item.plants?.common_names?.[0] && (
                      <span className={styles.plantCommon}>{item.plants.common_names[0]}</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                  <td style={{ color: '#6a6a6a', fontSize: '0.85rem' }}>{item.price_unit ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Nursery respond form (for nursery owners) */}
        {nursery && !isRequester && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {myNurseryResponse?.status === 'quoted'
                ? 'Your quote (submitted)'
                : 'Submit a quote'}
            </h2>

            {myNurseryResponse?.status === 'quoted' ? (
              <div className={styles.successBox}>
                You submitted a quote of {formatKes(myNurseryResponse.total_quoted_kes)}.
                The client will review it shortly.
                <button
                  type="button"
                  style={{ marginLeft: 12, background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setRespondMode(true)}
                >
                  Update quote
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => setRespondMode(!respondMode)}
              >
                {respondMode ? 'Cancel' : 'Write a quote →'}
              </button>
            )}

            {respondMode && (
              <form onSubmit={handleRespond} className={styles.respondForm} style={{ marginTop: 20 }}>
                <div className={styles.respondFormGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="totalQuoted">Total quote (KES) *</label>
                    <input
                      id="totalQuoted"
                      type="number"
                      placeholder="e.g. 180000"
                      value={totalQuoted}
                      onChange={e => setTotalQuoted(e.target.value)}
                      required
                      min={1}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="validUntil">Quote valid until</label>
                    <input
                      id="validUntil"
                      type="date"
                      value={validUntil}
                      onChange={e => setValidUntil(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="leadDays">Lead time (days)</label>
                    <input
                      id="leadDays"
                      type="number"
                      placeholder="e.g. 14"
                      value={leadDays}
                      onChange={e => setLeadDays(e.target.value)}
                      min={1}
                    />
                  </div>
                </div>

                {/* Per-plant pricing */}
                <div className={styles.formGroup}>
                  <label>Unit pricing (optional)</label>
                  <table className={styles.unitPriceTable}>
                    <thead>
                      <tr>
                        <th>Plant</th>
                        <th>Unit price (KES)</th>
                        <th>Qty available</th>
                        <th>Size / pot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfq.rfq_items.map(item => (
                        <tr key={item.plant_id}>
                          <td>{item.plants?.scientific_name ?? item.plant_id}</td>
                          <td>
                            <input
                              type="number"
                              placeholder="price"
                              min={0}
                              value={responseItems[item.plant_id]?.price ?? ''}
                              onChange={e => setResponseItems(prev => ({
                                ...prev,
                                [item.plant_id]: { ...prev[item.plant_id], price: e.target.value },
                              }))}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              placeholder={String(item.quantity)}
                              min={0}
                              value={responseItems[item.plant_id]?.qty ?? ''}
                              onChange={e => setResponseItems(prev => ({
                                ...prev,
                                [item.plant_id]: { ...prev[item.plant_id], qty: e.target.value },
                              }))}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="e.g. 30L bag"
                              value={responseItems[item.plant_id]?.size ?? ''}
                              onChange={e => setResponseItems(prev => ({
                                ...prev,
                                [item.plant_id]: { ...prev[item.plant_id], size: e.target.value },
                              }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="respondNotes">Notes</label>
                  <textarea
                    id="respondNotes"
                    placeholder="Availability, substitutions, delivery conditions…"
                    value={respondNotes}
                    onChange={e => setRespondNotes(e.target.value)}
                    maxLength={2000}
                  />
                </div>

                {respondError && <div className={styles.errorBox}>{respondError}</div>}

                <button type="submit" className={styles.submitBtn} disabled={responding}>
                  {responding ? 'Submitting…' : 'Submit quote →'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Invite nurseries — requester view, only when not yet accepted */}
        {isRequester && rfq.status !== 'accepted' && rfq.status !== 'cancelled' && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Invite nurseries to quote</h2>
            <p style={{ fontSize: '0.85rem', color: '#6a6a6a', margin: '0 0 14px' }}>
              Showing nurseries in {rfq.delivery_county}. Search to widen.
            </p>
            <input
              type="text"
              placeholder="Search nurseries by name…"
              value={inviteSearch}
              onChange={e => setInviteSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                marginBottom: 14,
              }}
            />

            {inviteError && <div className={styles.errorBox} style={{ marginBottom: 10 }}>{inviteError}</div>}

            {inviteLoading ? (
              <p style={{ color: '#6a6a6a', fontSize: '0.85rem' }}>Searching…</p>
            ) : inviteResults.length === 0 ? (
              <p style={{ color: '#6a6a6a', fontSize: '0.85rem' }}>No nurseries found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inviteResults.slice(0, 8).map(n => {
                  const alreadyInvited = rfq.rfq_responses.some(r => r.nursery_id === n.id)
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        border: '1px solid rgba(0,0,0,0.07)',
                        borderRadius: 8,
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                          {n.name}
                          {n.is_verified && <span style={{ marginLeft: 6, color: 'var(--color-accent)', fontSize: '0.75rem' }}>✓ Verified</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6a6a6a' }}>{n.county ?? 'Location not set'}</div>
                      </div>
                      <button
                        type="button"
                        className={alreadyInvited ? styles.declineBtn : styles.acceptBtn}
                        disabled={alreadyInvited || inviting === n.id}
                        onClick={() => inviteNursery(n.id)}
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        {alreadyInvited ? 'Invited' : inviting === n.id ? 'Inviting…' : '+ Invite'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Responses — requester view */}
        {isRequester && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Nursery responses ({quotedResponses.length})
            </h2>

            {rfq.rfq_responses.length === 0 ? (
              <p style={{ color: '#6a6a6a', fontSize: '0.9rem' }}>
                No responses yet. Nurseries in {rfq.delivery_county} will be notified.
              </p>
            ) : rfq.rfq_responses.filter(r => r.status === 'pending').length === rfq.rfq_responses.length ? (
              <p style={{ color: '#6a6a6a', fontSize: '0.9rem' }}>
                Responses pending — nurseries have been notified.
              </p>
            ) : (
              <div className={styles.responsesWrap}>
                {rfq.rfq_responses
                  .filter(r => r.status !== 'pending')
                  .map(resp => (
                    <div
                      key={resp.id}
                      className={`${styles.responseCard} ${resp.status === 'accepted' ? styles.accepted : ''} ${resp.status === 'declined' ? styles.declined : ''}`}
                    >
                      <div className={styles.responseHead}>
                        <div>
                          <Link to={`/nurseries/${resp.nurseries?.slug}`} className={styles.nurseryLink}>
                            {resp.nurseries?.name ?? 'Unknown nursery'}
                            {resp.nurseries?.is_verified && <span style={{ marginLeft: 6, color: 'var(--color-accent)', fontSize: '0.8rem' }}>✓ Verified</span>}
                          </Link>
                          <div style={{ fontSize: '0.8rem', color: '#6a6a6a', marginTop: 2, display: 'flex', gap: 12 }}>
                            {resp.nurseries?.county && <span>{resp.nurseries.county}</span>}
                            {resp.delivery_lead_days && <span>{resp.delivery_lead_days} days lead time</span>}
                            {resp.valid_until && <span>Valid until {formatDate(resp.valid_until)}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className={styles.responseTotal}>{formatKes(resp.total_quoted_kes)}</div>
                          <span className={`${styles.badge} ${styles[`badge-${resp.status}`] ?? ''}`} style={{ marginTop: 4 }}>
                            {resp.status}
                          </span>
                        </div>
                      </div>

                      {/* Line items breakdown */}
                      {resp.rfq_response_items.length > 0 && (
                        <table className={styles.responseTable}>
                          <thead>
                            <tr>
                              <th>Plant</th>
                              <th>Unit price</th>
                              <th>Qty</th>
                              <th>Size</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resp.rfq_response_items.map(ri => {
                              const item = rfq.rfq_items.find(i => i.plant_id === ri.plant_id)
                              return (
                                <tr key={ri.id}>
                                  <td>{item?.plants?.scientific_name ?? ri.plant_id}</td>
                                  <td>{formatKes(ri.unit_price_kes)}</td>
                                  <td>{ri.quantity_available ?? '—'}</td>
                                  <td style={{ color: '#6a6a6a' }}>{ri.container_size ?? '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}

                      {resp.notes && (
                        <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: '10px 0 0' }}>{resp.notes}</p>
                      )}

                      {/* Accept / decline (only if RFQ not yet accepted) */}
                      {rfq.status !== 'accepted' && rfq.status !== 'cancelled' && resp.status === 'quoted' && (
                        <div className={styles.actionRow}>
                          <button
                            className={styles.acceptBtn}
                            disabled={actioning !== null}
                            onClick={() => handleAction(resp.id, 'accept')}
                          >
                            {actioning === resp.id + 'accept' ? 'Accepting…' : 'Accept quote'}
                          </button>
                          <button
                            className={styles.declineBtn}
                            disabled={actioning !== null}
                            onClick={() => handleAction(resp.id, 'decline')}
                          >
                            {actioning === resp.id + 'decline' ? 'Declining…' : 'Decline'}
                          </button>
                        </div>
                      )}

                      {resp.status === 'accepted' && (
                        <p style={{ color: '#15803d', fontWeight: 600, fontSize: '0.9rem', marginTop: 10 }}>
                          Quote accepted — contact nursery to arrange delivery.
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
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
        <BotaniqueMark size={28} variant="light" />
        <span>Ask Botanique</span>
      </Link>
      <div className={styles.navRight}>
        <Link to="/explore" className={styles.navLink}>Browse plants</Link>
        {user
          ? <Link to="/rfq/my" className={styles.navLink}>My quotes</Link>
          : <Link to="/login" className={styles.navBtn}>Sign in</Link>}
      </div>
    </nav>
  )
}
