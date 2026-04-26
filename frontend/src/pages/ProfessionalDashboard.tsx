import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './Professionals.module.css'
import { PRO_TYPE_LABELS, PRO_TYPE_ICONS } from './Professionals'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const KENYAN_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa','Muranga','Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River',
  'Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
]

interface Professional {
  id: string
  business_name: string
  slug: string
  professional_type: string
  bio: string | null
  counties_served: string[] | null
  specialties: string[] | null
  years_experience: number | null
  profile_image_url: string | null
  certifications: string[] | null
  min_project_kes: number | null
  is_verified: boolean
  is_active: boolean
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
}

export default function ProfessionalDashboard() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [pro, setPro] = useState<Professional | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [years, setYears] = useState('')
  const [minProject, setMinProject] = useState('')
  const [counties, setCounties] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?next=/pro/dashboard'); return }
    let cancelled = false

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const t = session?.access_token ?? null
        if (!t) throw new Error('Not signed in.')
        if (cancelled) return
        setToken(t)

        const res = await fetch(`${API_BASE}/api/professionals/me`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error || 'Could not load profile.')
        if (!j.professional) {
          navigate('/pro/signup', { replace: true })
          return
        }
        if (cancelled) return
        setPro(j.professional)
        populateEdit(j.professional)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unexpected error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, user, navigate])

  function populateEdit(p: Professional) {
    setBio(p.bio ?? '')
    setPhone(p.phone ?? '')
    setWhatsapp(p.whatsapp ?? '')
    setEmail(p.email ?? '')
    setWebsite(p.website ?? '')
    setYears(p.years_experience != null ? String(p.years_experience) : '')
    setMinProject(p.min_project_kes != null ? String(p.min_project_kes) : '')
    setCounties(p.counties_served ?? [])
  }

  function toggleCounty(c: string) {
    setCounties(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const res = await fetch(`${API_BASE}/api/professionals/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bio: bio.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          counties_served: counties,
          years_experience: years ? parseInt(years, 10) : null,
          min_project_kes: minProject ? parseInt(minProject, 10) : null,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Update failed.')
      setPro(j.professional)
      setSaveSuccess(true)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) return <div className={styles.loadingPage}>Loading dashboard…</div>
  if (!pro) return null

  const icon = PRO_TYPE_ICONS[pro.professional_type] ?? '🌿'
  const typeLabel = PRO_TYPE_LABELS[pro.professional_type] ?? pro.professional_type.replace(/_/g, ' ')

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
          <span>Ask Botanique</span>
        </Link>
        <div className={styles.navRight}>
          <Link to="/professionals" className={styles.navLink}>Directory</Link>
          <Link to={`/professionals/${pro.slug}`} className={styles.navBtn}>View public profile →</Link>
        </div>
      </nav>

      <main className={styles.formPage}>
        {error && <div className={styles.errorBox} style={{ marginBottom: 16 }}>{error}</div>}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div className={styles.profileAvatarPlaceholder} style={{ width: 56, height: 56, fontSize: '1.6rem' }}>
            {icon}
          </div>
          <div>
            <h1 style={{ font: 'inherit', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', margin: '0 0 3px' }}>
              {pro.business_name}
              {pro.is_verified
                ? <span style={{ marginLeft: 10, fontSize: '0.7rem', background: '#f0fdf4', color: '#15803d', fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>✓ Verified</span>
                : <span style={{ marginLeft: 10, fontSize: '0.7rem', background: '#fef9c3', color: '#854d0e', fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>Pending verification</span>}
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#6a6a6a' }}>{typeLabel}</div>
          </div>
        </div>

        {saveSuccess && (
          <div className={styles.successBox} style={{ marginBottom: 18 }}>Profile updated successfully.</div>
        )}

        {!editing ? (
          <>
            {/* Read view */}
            <div className={styles.formSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className={styles.formSectionTitle} style={{ margin: 0 }}>Profile</h2>
                <button
                  type="button"
                  className={styles.submitBtn}
                  style={{ padding: '7px 20px', fontSize: '0.85rem' }}
                  onClick={() => { populateEdit(pro); setEditing(true) }}
                >
                  Edit profile
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: '0.9rem' }}>
                {[
                  ['Bio', pro.bio ?? '—'],
                  ['Counties served', pro.counties_served?.join(', ') ?? '—'],
                  ['Phone', pro.phone ?? '—'],
                  ['WhatsApp', pro.whatsapp ?? '—'],
                  ['Email', pro.email ?? '—'],
                  ['Website', pro.website ?? '—'],
                  ['Years experience', pro.years_experience != null ? `${pro.years_experience} years` : '—'],
                  ['Min project', pro.min_project_kes != null ? `KES ${pro.min_project_kes.toLocaleString()}` : '—'],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                    <div style={{ color: 'var(--color-primary)', fontWeight: 600, wordBreak: 'break-word' }}>{value}</div>
                  </div>
                ))}
              </div>

              {pro.specialties && pro.specialties.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Specialties</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pro.specialties.map(s => (
                      <span key={s} className={styles.certTag} style={{ fontSize: '0.8rem' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSave}>
            <div className={styles.formSection}>
              <h2 className={styles.formSectionTitle}>Edit profile</h2>
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="editBio">About your business</label>
                  <textarea
                    id="editBio"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    maxLength={2000}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Phone</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>WhatsApp</label>
                    <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Website</label>
                    <input type="url" value={website} onChange={e => setWebsite(e.target.value)} />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Years of experience</label>
                    <input type="number" value={years} onChange={e => setYears(e.target.value)} min={0} max={80} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Minimum project (KES)</label>
                    <input type="number" value={minProject} onChange={e => setMinProject(e.target.value)} min={0} />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <h2 className={styles.formSectionTitle}>Counties served</h2>
              <div className={styles.countyGrid}>
                {KENYAN_COUNTIES.map(c => (
                  <label key={c} className={styles.countyCheck}>
                    <input type="checkbox" checked={counties.includes(c)} onChange={() => toggleCounty(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            {saveError && <div className={styles.errorBox} style={{ marginBottom: 14 }}>{saveError}</div>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className={styles.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 24, padding: '12px 24px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, color: '#4b5563' }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
