import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './Professionals.module.css'
import { PRO_TYPES } from './Professionals'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const KENYAN_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa','Muranga','Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River',
  'Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
]

const SPECIALTIES_BY_TYPE: Record<string, string[]> = {
  landscape_architect: [
    'Residential gardens','Commercial landscapes','Masterplanning','Rooftop gardens',
    'Water features','Sustainable design','ASAL landscapes','Urban greening','Environmental impact',
  ],
  landscape_designer: [
    'Residential gardens','Courtyard design','Planting schemes','Soft landscaping',
    'Garden makeovers','Rooftop gardens','Indoor plant design','Colour planting',
  ],
  horticulturist: [
    'Greenhouse setup','Kitchen gardens','Vegetable gardens','Fruit orchards',
    'Hydroponics','Soil health & composting','Crop protection','Organic farming',
    'Seedling production','Propagation','Nursery management',
  ],
  florist: [
    'Bouquets & arrangements','Wedding & bridal','Event decoration',
    'Corporate & hospitality','Funeral arrangements','Potted plant gifts',
    'Flower delivery','Subscription flowers','Floral installations',
  ],
  gardener: [
    'Lawn maintenance','Pruning & trimming','Hedge maintenance','Weeding',
    'Fertilisation','Seasonal planting','Potted plant care','Garden clean-up',
  ],
  irrigation: [
    'Drip irrigation','Sprinkler systems','Borehole systems','Tank installation',
    'Irrigation design','System maintenance','Smart irrigation','Rainwater harvesting',
  ],
  pest_control: [
    'Garden pest management','Soil fumigation','Foliar spraying','Integrated pest management',
    'Termite control','Rodent control','Organic pest control','Disease diagnosis',
  ],
  garden_contractor: [
    'Hard landscaping','Paving & pathways','Retaining walls','Gabion walls',
    'Decking & pergolas','Fencing','Earthworks','Drainage','Site clearance',
  ],
}

export default function ProfessionalSignup() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)

  // Form state
  const [businessName, setBusinessName] = useState('')
  const [proType, setProType] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [years, setYears] = useState('')
  const [minProject, setMinProject] = useState('')
  const [certs, setCerts] = useState('')
  const [counties, setCounties] = useState<string[]>([])
  const [specialties, setSpecialties] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
  }, [user])

  // Reset specialties when type changes
  useEffect(() => {
    setSpecialties([])
  }, [proType])

  function toggleCounty(c: string) {
    setCounties(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function toggleSpecialty(s: string) {
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setError('You must be signed in.'); return }
    if (!businessName.trim()) { setError('Business name is required.'); return }
    if (!proType) { setError('Please select your professional type.'); return }
    if (counties.length === 0) { setError('Please select at least one county you serve.'); return }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/professionals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_name: businessName.trim(),
          professional_type: proType,
          bio: bio.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          counties_served: counties,
          specialties,
          years_experience: years ? parseInt(years, 10) : null,
          min_project_kes: minProject ? parseInt(minProject, 10) : null,
          certifications: certs
            .split(',')
            .map(c => c.trim())
            .filter(Boolean),
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Could not create profile.')

      setSuccess(true)
      setTimeout(() => navigate('/pro/dashboard'), 1500)
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
            <h2 style={{ color: 'var(--color-primary)', margin: '0 0 12px' }}>Sign in to list your services</h2>
            <p style={{ color: '#6a6a6a', marginBottom: 24 }}>
              Create an account to join Kenya's professional garden services directory.
            </p>
            <Link to="/signup?next=/pro/signup" style={{ display: 'inline-block', background: 'var(--color-primary)', color: '#fff', borderRadius: 24, padding: '11px 26px', textDecoration: 'none', fontWeight: 700 }}>
              Create account
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const availableSpecialties = proType ? (SPECIALTIES_BY_TYPE[proType] ?? []) : []

  return (
    <div className={styles.page}>
      <Nav />
      <main className={styles.formPage}>
        <h1 className={styles.pageTitle}>List your services</h1>
        <p className={styles.pageSubtitle}>
          Join thousands of clients searching for landscape, garden and floral professionals across Kenya.
        </p>

        {success && (
          <div className={styles.successBox} style={{ marginBottom: 20 }}>
            Profile created! Redirecting to your dashboard…
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic info */}
          <div className={styles.formSection}>
            <h2 className={styles.formSectionTitle}>Basic information</h2>
            <div className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="businessName">Business / trading name *</label>
                  <input
                    id="businessName"
                    type="text"
                    placeholder="e.g. GreenScape Nairobi"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    maxLength={200}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="proType">Professional type *</label>
                  <select
                    id="proType"
                    value={proType}
                    onChange={e => setProType(e.target.value)}
                    required
                  >
                    <option value="">Select type…</option>
                    {PRO_TYPES.filter(t => t.slug).map(t => (
                      <option key={t.slug} value={t.slug}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="bio">About your business</label>
                <textarea
                  id="bio"
                  placeholder={
                    proType === 'florist'
                      ? 'Tell clients about your flowers, arrangements and what makes your service special…'
                      : proType === 'horticulturist'
                      ? 'Describe your expertise — greenhouse design, kitchen gardens, orchard management…'
                      : 'Describe your services, approach and what sets you apart…'
                  }
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={2000}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="years">Years of experience</label>
                  <input
                    id="years"
                    type="number"
                    placeholder="e.g. 8"
                    value={years}
                    onChange={e => setYears(e.target.value)}
                    min={0}
                    max={80}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="minProject">Minimum project size (KES)</label>
                  <input
                    id="minProject"
                    type="number"
                    placeholder="e.g. 15000"
                    value={minProject}
                    onChange={e => setMinProject(e.target.value)}
                    min={0}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="certs">Certifications (comma-separated)</label>
                <input
                  id="certs"
                  type="text"
                  placeholder="e.g. KILA member, Eco-certified, KEPHIS licensed"
                  value={certs}
                  onChange={e => setCerts(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Specialties — dynamic per type */}
          {proType && availableSpecialties.length > 0 && (
            <div className={styles.formSection}>
              <h2 className={styles.formSectionTitle}>Your specialties</h2>
              <p style={{ fontSize: '0.85rem', color: '#6a6a6a', margin: '0 0 14px' }}>
                Select all that apply.
              </p>
              <div className={styles.specGrid}>
                {availableSpecialties.map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.specToggle} ${specialties.includes(s) ? styles.specToggleActive : ''}`}
                    onClick={() => toggleSpecialty(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Counties served */}
          <div className={styles.formSection}>
            <h2 className={styles.formSectionTitle}>Counties served *</h2>
            <p style={{ fontSize: '0.85rem', color: '#6a6a6a', margin: '0 0 14px' }}>
              Select all counties where you offer your services.
            </p>
            <div className={styles.countyGrid}>
              {KENYAN_COUNTIES.map(c => (
                <label key={c} className={styles.countyCheck}>
                  <input
                    type="checkbox"
                    checked={counties.includes(c)}
                    onChange={() => toggleCounty(c)}
                  />
                  {c}
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
                  <label htmlFor="whatsapp">WhatsApp number</label>
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
            {submitting ? 'Creating profile…' : 'Create professional profile →'}
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
        <Link to="/professionals" className={styles.navLink}>Browse professionals</Link>
        <Link to="/login" className={styles.navLink}>Sign in</Link>
      </div>
    </nav>
  )
}
