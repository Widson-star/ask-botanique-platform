import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LayoutGrid, Compass, PenTool, Sprout, Flower2,
  Scissors, Droplets, ShieldCheck, HardHat, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import styles from './Professionals.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const KENYAN_COUNTIES = [
  'Nairobi','Kiambu','Nakuru','Mombasa','Kisumu','Nyeri','Machakos','Kajiado','Meru',
  'Uasin Gishu','Laikipia','Nyandarua','Kirinyaga','Muranga','Embu','Tharaka-Nithi',
]

export const PRO_TYPES: { slug: string; label: string; Icon: LucideIcon }[] = [
  { slug: '',                    label: 'All professionals',    Icon: LayoutGrid  },
  { slug: 'landscape_architect', label: 'Landscape Architects', Icon: Compass     },
  { slug: 'landscape_designer',  label: 'Landscape Designers',  Icon: PenTool     },
  { slug: 'horticulturist',      label: 'Horticulturists',      Icon: Sprout      },
  { slug: 'florist',             label: 'Florists',             Icon: Flower2     },
  { slug: 'gardener',            label: 'Gardeners',            Icon: Scissors    },
  { slug: 'irrigation',          label: 'Irrigation',           Icon: Droplets    },
  { slug: 'pest_control',        label: 'Pest Control',         Icon: ShieldCheck },
  { slug: 'garden_contractor',   label: 'Garden Contractors',   Icon: HardHat     },
]

export const PRO_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PRO_TYPES.filter(t => t.slug).map(t => [t.slug, t.label])
)

export const PRO_TYPE_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  PRO_TYPES.filter(t => t.slug).map(t => [t.slug, t.Icon])
)

/** Renders the correct Lucide icon for a professional_type slug */
export function ProTypeIcon({
  type,
  size = 22,
  color = 'var(--color-primary)',
}: {
  type: string
  size?: number
  color?: string
}) {
  const Icon = PRO_TYPE_ICON_MAP[type] ?? Sprout
  return <Icon size={size} color={color} strokeWidth={1.8} />
}

interface ProCard {
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
  phone: string | null
  whatsapp: string | null
}

export default function Professionals() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [q, setQ]         = useState(() => searchParams.get('q') ?? '')
  const [type, setType]   = useState(() => searchParams.get('type') ?? '')
  const [county, setCounty] = useState(() => searchParams.get('county') ?? '')
  const [items, setItems] = useState<ProCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPros = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (type) params.set('type', type)
      if (county) params.set('county', county)
      const res = await fetch(`${API_BASE}/api/professionals?${params}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Could not load professionals')
      setItems(j.professionals ?? [])
      setTotal(j.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load.')
    } finally {
      setLoading(false)
    }
  }, [q, type, county])

  useEffect(() => {
    const t = setTimeout(fetchPros, 280)
    return () => clearTimeout(t)
  }, [fetchPros])

  return (
    <div className={styles.page}>
      {/* NAV */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
          <span>Ask Botanique</span>
        </Link>
        <div className={styles.navRight}>
          <Link to="/explore" className={styles.navLink}>Browse plants</Link>
          <Link to="/nurseries" className={styles.navLink}>Nurseries</Link>
          {user
            ? <Link to="/pro/dashboard" className={styles.navBtn}>My profile →</Link>
            : <Link to="/pro/signup" className={styles.navBtn}>List your services</Link>}
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.heroWrap}>
        <div>
          <span className={styles.heroEyebrow}>Professional Directory</span>
          <h1 className={styles.heroTitle}>Find a garden professional near you.</h1>
          <p className={styles.heroLede}>
            Verified landscape architects, florists, horticulturists, gardeners, irrigation specialists and more — across Kenya.
          </p>
          <form
            className={styles.heroSearch}
            onSubmit={e => { e.preventDefault(); fetchPros() }}
          >
            <input
              className={styles.heroSearchInput}
              type="text"
              placeholder="Search by name, specialty — e.g. 'greenhouse setup', 'wedding flowers'…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <select
              className={styles.heroCountySelect}
              value={county}
              onChange={e => setCounty(e.target.value)}
            >
              <option value="">All counties</option>
              {KENYAN_COUNTIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="submit" className={styles.heroSearchBtn}>Search</button>
          </form>
        </div>
      </section>

      {/* CATEGORY STRIP */}
      <div className={styles.typeStrip}>
        <div className={styles.typeStripInner}>
          {PRO_TYPES.map(t => (
            <button
              key={t.slug}
              className={`${styles.typeChip} ${type === t.slug ? styles.typeChipActive : ''}`}
              onClick={() => setType(t.slug)}
            >
              <t.Icon size={15} strokeWidth={2} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* GRID */}
      <main className={styles.listMain}>
        <div className={styles.listMeta}>
          {loading ? 'Loading…' : `${total} professional${total === 1 ? '' : 's'}`}
        </div>

        {error && <div className={styles.errorBox} style={{ marginBottom: 16 }}>{error}</div>}

        {items.length === 0 && !loading ? (
          <div className={styles.emptyInv}>
            <p style={{ fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 8px' }}>
              No professionals match these filters yet.
            </p>
            <p style={{ color: '#6a6a6a', margin: '0 0 20px' }}>
              We're onboarding professionals across East Africa. Are you a landscaper, florist, or horticulturist?
            </p>
            <Link to="/pro/signup" style={{ display: 'inline-block', background: 'var(--color-primary)', color: '#fff', borderRadius: 24, padding: '10px 24px', textDecoration: 'none', fontWeight: 700 }}>
              Create your profile →
            </Link>
          </div>
        ) : (
          <div className={styles.proGrid}>
            {items.map(pro => (
              <ProCard key={pro.id} pro={pro} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProCard({ pro }: { pro: ProCard }) {
  const typeLabel = PRO_TYPE_LABELS[pro.professional_type] ?? pro.professional_type.replace(/_/g, ' ')
  const counties = pro.counties_served?.slice(0, 3).join(', ') ?? 'Location not set'
  const waLink = pro.whatsapp
    ? `https://wa.me/${pro.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I found your profile on Ask Botanique and would like to enquire about your services.`)}`
    : null

  return (
    <Link to={`/professionals/${pro.slug}`} className={styles.proCard}>
      <div className={styles.proCardHead}>
        {pro.profile_image_url ? (
          <img src={pro.profile_image_url} alt={pro.business_name} className={styles.proAvatar} />
        ) : (
          <div className={styles.proAvatarPlaceholder}>
            <ProTypeIcon type={pro.professional_type} size={24} />
          </div>
        )}
        <div className={styles.proCardMeta}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <p className={styles.proName}>{pro.business_name}</p>
            {pro.is_verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
          </div>
          <span className={styles.proTypeBadge}>{typeLabel}</span>
          <div className={styles.proCounty}>{counties}{pro.counties_served && pro.counties_served.length > 3 ? ` +${pro.counties_served.length - 3} more` : ''}</div>
        </div>
      </div>

      {pro.bio && (
        <p className={styles.proBio}>{pro.bio}</p>
      )}

      {pro.specialties && pro.specialties.length > 0 && (
        <div className={styles.proSpecs}>
          {pro.specialties.slice(0, 4).map(s => (
            <span key={s} className={styles.specTag}>{s.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}

      <div className={styles.proCardFoot} onClick={e => e.preventDefault()}>
        <span className={styles.proExp}>
          {pro.years_experience ? `${pro.years_experience} yrs experience` : ''}
          {pro.min_project_kes ? ` · From KES ${pro.min_project_kes.toLocaleString()}` : ''}
        </span>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.contactBtn}
            onClick={e => e.stopPropagation()}
          >
            WhatsApp
          </a>
        )}
      </div>
    </Link>
  )
}
