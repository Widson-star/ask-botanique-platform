import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './Supplies.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const KENYAN_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa','Muranga','Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River',
  'Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
]

const ALL_CATEGORIES = [
  { value: 'pots',       label: 'Pots & Planters',  hint: 'Concrete, plastic, ceramic, grow bags…'         },
  { value: 'irrigation', label: 'Irrigation',        hint: 'Drip lines, sprinklers, pipes, fittings…'       },
  { value: 'pesticides', label: 'Pesticides',        hint: 'Insecticides, fungicides, herbicides…'           },
  { value: 'fertilizer', label: 'Fertilizers',       hint: 'Organic compost, NPK blends, foliar feed…'      },
  { value: 'tools',      label: 'Garden Tools',      hint: 'Pruners, spades, wheelbarrows, mowers…'         },
  { value: 'structures', label: 'Structures',        hint: 'Greenhouses, pergolas, trellises, fencing…'     },
]

export default function SupplierSignup() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)

  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [county, setCounty]       = useState('')
  const [categories, setCats]     = useState<string[]>([])
  const [phone, setPhone]         = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [email, setEmail]         = useState('')
  const [website, setWebsite]     = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
  }, [user])

  function toggleCat(v: string) {
    setCats(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token)                { setError('You must be signed in.'); return }
    if (!name.trim())          { setError('Business name is required.'); return }
    if (!county)               { setError('Please select your county.'); return }
    if (categories.length === 0) { setError('Please select at least one product category.'); return }
    if (!whatsapp && !phone)   { setError('Please add at least one contact number (phone or WhatsApp).'); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          county,
          categories,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Could not create profile.')

      setSuccess(true)
      setTimeout(() => navigate('/supplier/dashboard'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return <div className={styles.loadingPage}>Loading…</div>

  if (!user) {
    return (
      <div className={styles.page}>
        <Nav />
        <main className={styles.formPage}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h2 style={{ color: 'var(--color-primary)', margin: '0 0 12px' }}>Sign in to list your products</h2>
            <p style={{ color: '#6a6a6a', marginBottom: 24 }}>
              Create an account to join Kenya's garden supplies marketplace.
            </p>
            <Link
              to="/signup?next=/supplier/signup"
              style={{
                display: 'inline-block', background: 'var(--color-primary)', color: '#fff',
                borderRadius: 24, padding: '11px 26px', textDecoration: 'none', fontWeight: 700,
              }}
            >
              Create account
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Nav />
      <main className={styles.formPage}>
        <h1 className={styles.pageTitle}>List your products</h1>
        <p className={styles.pageSubtitle}>
          Reach gardeners and landscapers across Kenya searching for pots, irrigation,
          tools and more.
        </p>

        {success && (
          <div className={styles.successBox} style={{ marginBottom: 20 }}>
            Supplier profile created! Redirecting to your dashboard…
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Business info */}
          <div className={styles.formSection}>
            <h2 className={styles.formSectionTitle}>Business information</h2>
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="bname">Business / shop name *</label>
                <input
                  id="bname"
                  type="text"
                  placeholder="e.g. Greenline Agro Supplies"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="desc">About your business</label>
                <textarea
                  id="desc"
                  placeholder="Describe what you sell, your specialties, delivery areas or any USPs…"
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                  maxLength={2000}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="county">County (primary location) *</label>
                <select
                  id="county"
                  value={county}
                  onChange={e => setCounty(e.target.value)}
                  required
                >
                  <option value="">Select county…</option>
                  {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Product categories */}
          <div className={styles.formSection}>
            <h2 className={styles.formSectionTitle}>What do you sell? *</h2>
            <p style={{ fontSize: '0.85rem', color: '#6a6a6a', margin: '0 0 14px' }}>
              Select all categories that apply. You can add individual products after signing up.
            </p>
            <div className={styles.catCheckGrid}>
              {ALL_CATEGORIES.map(({ value, label, hint }) => (
                <label key={value} className={styles.catCheck} title={hint}>
                  <input
                    type="checkbox"
                    checked={categories.includes(value)}
                    onChange={() => toggleCat(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Contact details */}
          <div className={styles.formSection}>
            <h2 className={styles.formSectionTitle}>Contact details</h2>
            <div className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+254 700 000 000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="whatsapp">WhatsApp number *</label>
                  <input
                    id="whatsapp"
                    type="tel"
                    placeholder="+254 700 000 000"
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="email">Business email</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="hello@yourbusiness.co.ke"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="website">Website / Instagram</label>
                  <input
                    id="website"
                    type="url"
                    placeholder="https://"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <div className={styles.errorBox} style={{ marginBottom: 16 }}>{error}</div>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || success}
          >
            {submitting ? 'Creating profile…' : 'Create supplier profile →'}
          </button>
        </form>
      </main>
    </div>
  )
}

function Nav() {
  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
        <span>Ask Botanique</span>
      </Link>
      <div className={styles.navRight}>
        <Link to="/supplies" className={styles.navLink}>Browse supplies</Link>
        <Link to="/login" className={styles.navLink}>Sign in</Link>
      </div>
    </nav>
  )
}
