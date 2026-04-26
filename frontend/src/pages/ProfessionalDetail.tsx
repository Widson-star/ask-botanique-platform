import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import styles from './Professionals.module.css'
import { PRO_TYPE_LABELS, ProTypeIcon } from './Professionals'
import { BotaniqueMark } from '../components/BotaniqueMark'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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
  portfolio_urls: string[] | null
  certifications: string[] | null
  min_project_kes: number | null
  is_verified: boolean
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  created_at: string
}

export default function ProfessionalDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [pro, setPro] = useState<Professional | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetch(`${API_BASE}/api/professionals/${slug}`)
      .then(r => r.json())
      .then(j => {
        if (j.error) throw new Error(j.error)
        setPro(j.professional)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return <div className={styles.loadingPage}>Loading…</div>
  }

  if (error || !pro) {
    return (
      <div className={styles.page}>
        <Nav />
        <main className={styles.profilePage}>
          <Link to="/professionals" className={styles.backLink}>← Back to professionals</Link>
          <div className={styles.errorBox}>{error ?? 'Professional not found.'}</div>
        </main>
      </div>
    )
  }

  const typeLabel = PRO_TYPE_LABELS[pro.professional_type] ?? pro.professional_type.replace(/_/g, ' ')
  const waLink = pro.whatsapp
    ? `https://wa.me/${pro.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${pro.business_name}, I found your profile on Ask Botanique and would like to enquire about your services.`)}`
    : null

  return (
    <div className={styles.page}>
      <Nav />
      <main className={styles.profilePage}>
        <Link to="/professionals" className={styles.backLink}>← Back to professionals</Link>

        {/* Header */}
        <div className={styles.profileHeader}>
          {pro.profile_image_url ? (
            <img src={pro.profile_image_url} alt={pro.business_name} className={styles.profileAvatar} />
          ) : (
            <div className={styles.profileAvatarPlaceholder}>
              <ProTypeIcon type={pro.professional_type} size={36} />
            </div>
          )}
          <div className={styles.profileHeaderText}>
            <h1 className={styles.profileName}>
              {pro.business_name}
              {pro.is_verified && (
                <span style={{ marginLeft: 10, fontSize: '0.7rem', background: '#f0fdf4', color: '#15803d', fontWeight: 700, padding: '3px 10px', borderRadius: 12, verticalAlign: 'middle' }}>
                  ✓ Verified
                </span>
              )}
            </h1>
            <div className={styles.profileType}>{typeLabel}</div>
            {pro.counties_served && pro.counties_served.length > 0 && (
              <div className={styles.profileCounties}>
                Serves: {pro.counties_served.join(', ')}
              </div>
            )}
            {pro.years_experience && (
              <div style={{ fontSize: '0.85rem', color: '#6a6a6a', marginTop: 4 }}>
                {pro.years_experience} years experience
              </div>
            )}
          </div>
        </div>

        {/* Two-column body */}
        <div className={styles.profileGrid}>
          <div>
            {/* Bio */}
            {pro.bio && (
              <div className={styles.profileSection}>
                <h2 className={styles.profileSectionTitle}>About</h2>
                <p className={styles.profileBio}>{pro.bio}</p>
              </div>
            )}

            {/* Specialties */}
            {pro.specialties && pro.specialties.length > 0 && (
              <div className={styles.profileSection}>
                <h2 className={styles.profileSectionTitle}>Specialties</h2>
                <div className={styles.specsWrap}>
                  {pro.specialties.map(s => (
                    <span key={s} className={styles.certTag}>{s.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {pro.certifications && pro.certifications.length > 0 && (
              <div className={styles.profileSection}>
                <h2 className={styles.profileSectionTitle}>Certifications</h2>
                <div className={styles.specsWrap}>
                  {pro.certifications.map(c => (
                    <span key={c} className={styles.certTag}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio links */}
            {pro.portfolio_urls && pro.portfolio_urls.length > 0 && (
              <div className={styles.profileSection}>
                <h2 className={styles.profileSectionTitle}>Portfolio</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pro.portfolio_urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-accent)', fontSize: '0.9rem', textDecoration: 'none' }}
                    >
                      Project {i + 1} →
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contact sidebar */}
          <div className={styles.contactCard}>
            <h2 className={styles.contactCardTitle}>Get in touch</h2>

            {pro.whatsapp && (
              <a href={waLink!} target="_blank" rel="noopener noreferrer" className={styles.whatsappBtn}>
                <span>💬</span> WhatsApp
              </a>
            )}

            {pro.phone && (
              <a href={`tel:${pro.phone}`} className={styles.contactItem} style={{ marginTop: 12 }}>
                <span>📞</span> {pro.phone}
              </a>
            )}

            {pro.email && (
              <a href={`mailto:${pro.email}`} className={styles.contactItem}>
                <span>✉️</span> {pro.email}
              </a>
            )}

            {pro.website && (
              <a href={pro.website} target="_blank" rel="noopener noreferrer" className={styles.contactItem}>
                <span>🌐</span> Website
              </a>
            )}

            {pro.min_project_kes && (
              <p className={styles.minProject}>
                Minimum project: KES {pro.min_project_kes.toLocaleString()}
              </p>
            )}

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', marginTop: 16, paddingTop: 14 }}>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
                Listed on Ask Botanique since {new Date(pro.created_at).getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Nav() {
  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <BotaniqueMark size={28} variant="light" />
        <span>Ask Botanique</span>
      </Link>
      <div className={styles.navRight}>
        <Link to="/professionals" className={styles.navLink}>Professionals</Link>
        <Link to="/nurseries" className={styles.navLink}>Nurseries</Link>
        <Link to="/pro/signup" className={styles.navBtn}>List your services</Link>
      </div>
    </nav>
  )
}
