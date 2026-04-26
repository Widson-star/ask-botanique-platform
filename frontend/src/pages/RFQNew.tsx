import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './RFQ.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const KENYAN_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa','Murang\'a','Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River',
  'Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
]

const PRICE_UNITS = ['seedling', 'sapling', 'mature', 'cutting', 'per_m2', 'per_kg']

interface ShortlistItem {
  plant_id: string
  scientific_name: string
  common_names: string[] | null
  quantity: number
  price_unit: string
}

export default function RFQNew() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [token, setToken] = useState<string | null>(null)

  // Shortlist from localStorage
  const [items, setItems] = useState<ShortlistItem[]>([])

  // Project brief fields
  const [projectName, setProjectName] = useState('')
  const [county, setCounty] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [budget, setBudget] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load auth token
  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
  }, [user])

  // Load shortlist from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rfq_shortlist')
      if (raw) {
        const parsed: ShortlistItem[] = JSON.parse(raw)
        setItems(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  function updateQty(plantId: string, qty: number) {
    setItems(prev => prev.map(it => it.plant_id === plantId ? { ...it, quantity: Math.max(1, qty) } : it))
  }

  function updateUnit(plantId: string, unit: string) {
    setItems(prev => prev.map(it => it.plant_id === plantId ? { ...it, price_unit: unit } : it))
  }

  function removeItem(plantId: string) {
    const next = items.filter(it => it.plant_id !== plantId)
    setItems(next)
    localStorage.setItem('rfq_shortlist', JSON.stringify(next))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setError('You must be logged in.'); return }
    if (items.length === 0) { setError('Your shortlist is empty.'); return }
    if (!projectName.trim()) { setError('Project name is required.'); return }
    if (!county) { setError('Delivery county is required.'); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/rfq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_name: projectName.trim(),
          delivery_county: county,
          delivery_date: deliveryDate || null,
          total_budget_kes: budget ? Number(budget) : null,
          notes: notes.trim() || null,
          items: items.map(it => ({
            plant_id: it.plant_id,
            quantity: it.quantity,
            price_unit: it.price_unit,
          })),
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to submit RFQ.')

      // Clear shortlist on success
      localStorage.removeItem('rfq_shortlist')
      setSuccess(true)

      setTimeout(() => navigate('/rfq/my'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return <div className={styles.page} style={{ alignItems: 'center', justifyContent: 'center' }}>Loading…</div>

  if (!user) {
    return (
      <div className={styles.page}>
        <Nav />
        <main className={styles.main}>
          <div className={styles.emptyState}>
            <h3>Sign in to request quotes</h3>
            <p>Create an account to shortlist plants and send quote requests to nurseries.</p>
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
        <Link to="/explore" className={styles.backLink}>← Back to explore</Link>
        <h1 className={styles.pageTitle}>Request for Quote</h1>
        <p className={styles.pageSubtitle}>Review your plant shortlist, add project details, and send to nurseries.</p>

        {success && (
          <div className={styles.successBox}>
            RFQ submitted! Redirecting to your quotes…
          </div>
        )}

        {/* Shortlist table */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Your shortlist ({items.length} {items.length === 1 ? 'plant' : 'plants'})</h2>

          {items.length === 0 ? (
            <div className={styles.emptyShortlist}>
              <p>No plants in your shortlist yet.</p>
              <p><Link to="/explore">Browse plants</Link> and click "Add to quote" on any plant card.</p>
            </div>
          ) : (
            <table className={styles.shortlistTable}>
              <thead>
                <tr>
                  <th>Plant</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.plant_id}>
                    <td>
                      <span className={styles.plantName}>{it.scientific_name}</span>
                      {it.common_names?.[0] && (
                        <span className={styles.plantCommon}>{it.common_names[0]}</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        className={styles.qtyInput}
                        value={it.quantity}
                        onChange={e => updateQty(it.plant_id, parseInt(e.target.value, 10) || 1)}
                      />
                    </td>
                    <td>
                      <select
                        className={styles.unitInput}
                        value={it.price_unit}
                        onChange={e => updateUnit(it.plant_id, e.target.value)}
                      >
                        {PRICE_UNITS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeItem(it.plant_id)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Project brief form */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Project details</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="projectName">Project name *</label>
                <input
                  id="projectName"
                  type="text"
                  placeholder="e.g. Runda Residence — Phase 2"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="county">Delivery county *</label>
                <select
                  id="county"
                  value={county}
                  onChange={e => setCounty(e.target.value)}
                  required
                >
                  <option value="">Select county</option>
                  {KENYAN_COUNTIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="deliveryDate">Required by (date)</label>
                <input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="budget">Total budget (KES)</label>
                <input
                  id="budget"
                  type="number"
                  placeholder="e.g. 250000"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  min={0}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="notes">Additional notes</label>
              <textarea
                id="notes"
                placeholder="Soil conditions, site access, delivery requirements, special requests…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={2000}
              />
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting || items.length === 0 || success}
            >
              {submitting ? 'Submitting…' : 'Send quote request →'}
            </button>
          </form>
        </div>
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
          ? <Link to="/rfq/my" className={styles.navBtn}>My quotes →</Link>
          : <Link to="/login" className={styles.navBtn}>Sign in</Link>}
      </div>
    </nav>
  )
}
