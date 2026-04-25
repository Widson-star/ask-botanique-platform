import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './Nursery.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const KENYA_COUNTIES = [
  'Nairobi', 'Kiambu', 'Kajiado', 'Machakos', 'Murang\'a', 'Nakuru', 'Nyeri',
  'Mombasa', 'Kilifi', 'Kwale', 'Lamu', 'Taita Taveta',
  'Kisumu', 'Siaya', 'Homa Bay', 'Kisii', 'Nyamira', 'Migori', 'Kakamega', 'Vihiga', 'Bungoma', 'Busia',
  'Uasin Gishu', 'Trans Nzoia', 'Nandi', 'Bomet', 'Kericho', 'Baringo', 'Laikipia', 'Nyandarua', 'Meru', 'Tharaka Nithi', 'Embu', 'Kitui', 'Makueni',
  'Narok', 'Samburu', 'Turkana', 'West Pokot', 'Marsabit', 'Isiolo', 'Garissa', 'Wajir', 'Mandera', 'Tana River', 'Elgeyo Marakwet',
]

const SPECIALTIES = [
  { slug: 'indigenous',     label: 'Indigenous trees' },
  { slug: 'ornamental',     label: 'Ornamentals' },
  { slug: 'fruit',          label: 'Fruit trees' },
  { slug: 'succulents',     label: 'Succulents' },
  { slug: 'cut-flower',     label: 'Cut flowers' },
  { slug: 'hedge',          label: 'Hedging' },
  { slug: 'indoor',         label: 'Indoor plants' },
  { slug: 'medicinal',      label: 'Medicinal' },
  { slug: 'grasses',        label: 'Grasses' },
  { slug: 'palms',          label: 'Palms' },
  { slug: 'wholesale',      label: 'Wholesale supply' },
  { slug: 'landscaping',    label: 'Landscaping service' },
]

export default function NurserySignup() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [checking, setChecking]   = useState(true)
  const [name, setName]           = useState('')
  const [county, setCounty]       = useState('Nairobi')
  const [description, setDesc]    = useState('')
  const [phone, setPhone]         = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [email, setEmail]         = useState('')
  const [website, setWebsite]     = useState('')
  const [address, setAddress]     = useState('')
  const [specialties, setSpecs]   = useState<string[]>([])
  const [deliveryCounties, setDC] = useState<string[]>([])
  const [minOrder, setMinOrder]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?next=/nursery/signup'); return }
    // If user already has a nursery, send them to the dashboard
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) { setChecking(false); return }
        const res = await fetch(`${API_BASE}/api/nurseries/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!cancelled && res.ok) {
          const j = await res.json()
          if (j?.nursery) { navigate('/nursery/dashboard', { replace: true }); return }
        }
      } catch {/* noop */}
      if (!cancelled) setChecking(false)
    })()
    return () => { cancelled = true }
  }, [authLoading, user, navigate])

  function toggleSpec(slug: string) {
    setSpecs(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])
  }
  function toggleDC(c: string) {
    setDC(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Nursery name is required.'); return }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('You must be signed in.')
      const res = await fetch(`${API_BASE}/api/nurseries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          county,
          description: description.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          address: address.trim() || null,
          specialties,
          delivery_counties: deliveryCounties,
          min_order_kes: minOrder ? parseInt(minOrder, 10) : null,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Could not create nursery.')
      navigate('/nursery/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || checking) {
    return <div className={styles.loadingPage}>Loading…</div>
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
          <span>Ask Botanique</span>
        </Link>
        <div className={styles.navRight}>
          <Link to="/explore" className={styles.navLink}>Browse plants</Link>
          <Link to="/nurseries" className={styles.navLink}>Nurseries</Link>
        </div>
      </nav>

      <main className={styles.formWrap}>
        <header className={styles.formHeader}>
          <span className={styles.eyebrow}>§ Nursery onboarding</span>
          <h1>List your nursery on Ask Botanique.</h1>
          <p className={styles.lede}>
            Reach landscape architects, designers and homeowners across East Africa.
            Free to list. We verify each nursery before publishing.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="name">Nursery name *</label>
            <input
              id="name"
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Muthaiga Nurseries"
              maxLength={120}
              required
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="county">County *</label>
              <select
                id="county"
                className={styles.input}
                value={county}
                onChange={e => setCounty(e.target.value)}
              >
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.fieldGroup} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="minOrder">Minimum order (KES)</label>
              <input
                id="minOrder"
                className={styles.input}
                type="number"
                inputMode="numeric"
                min="0"
                value={minOrder}
                onChange={e => setMinOrder(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="description">Description</label>
            <textarea
              id="description"
              className={styles.textarea}
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="What makes your nursery distinctive? Specialties, founding story, growing methods…"
              rows={4}
              maxLength={2000}
            />
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Specialties</span>
            <div className={styles.chipRow}>
              {SPECIALTIES.map(s => (
                <button
                  key={s.slug}
                  type="button"
                  className={`${styles.chip} ${specialties.includes(s.slug) ? styles.chipActive : ''}`}
                  onClick={() => toggleSpec(s.slug)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Counties you deliver to</span>
            <div className={styles.chipRow}>
              {KENYA_COUNTIES.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.chip} ${deliveryCounties.includes(c) ? styles.chipActive : ''}`}
                  onClick={() => toggleDC(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <h2 className={styles.subhead}>Contact</h2>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="phone">Phone</label>
              <input id="phone" className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
            </div>
            <div className={styles.fieldGroup} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" className={styles.input} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+254 7XX XXX XXX" />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input id="email" className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@yournursery.co.ke" />
            </div>
            <div className={styles.fieldGroup} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="website">Website</label>
              <input id="website" className={styles.input} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="address">Address</label>
            <input id="address" className={styles.input} value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Limuru Road, opposite Village Market" />
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <div className={styles.formActions}>
            <Link to="/" className={styles.cancelBtn}>Cancel</Link>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create nursery →'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
