import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Package, Droplets, Bug, Wheat, Wrench, Building2, MessageCircle } from 'lucide-react'
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

const SUPPLY_CATS = [
  { value: '',           label: 'All supplies',    Icon: LayoutGrid },
  { value: 'pots',       label: 'Pots & Planters', Icon: Package    },
  { value: 'irrigation', label: 'Irrigation',      Icon: Droplets   },
  { value: 'pesticides', label: 'Pesticides',      Icon: Bug        },
  { value: 'fertilizer', label: 'Fertilizers',     Icon: Wheat      },
  { value: 'tools',      label: 'Garden Tools',    Icon: Wrench     },
  { value: 'structures', label: 'Structures',      Icon: Building2  },
]

interface Supplier {
  id: string
  name: string
  slug: string
  description: string | null
  county: string | null
  categories: string[]
  whatsapp: string | null
  phone: string | null
  is_verified: boolean
}

function waLink(num: string, name: string) {
  const msg = encodeURIComponent(`Hi ${name}, I found you on Ask Botanique and I'm interested in your garden supplies.`)
  return `https://wa.me/${num.replace(/\D/g, '')}?text=${msg}`
}

export default function Supplies() {
  const [query, setQuery]           = useState('')
  const [county, setCounty]         = useState('')
  const [activeCat, setActiveCat]   = useState('')
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(true)

  const fetchSuppliers = useCallback(async (cat: string, cty: string, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cat) params.set('category', cat)
      if (cty) params.set('county', cty)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`${API_BASE}/api/supplies?${params}`)
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : (data.suppliers ?? []))
    } catch {
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers(activeCat, county, '')
  }, [activeCat, county, fetchSuppliers])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchSuppliers(activeCat, county, query)
  }

  return (
    <div className={styles.page}>
      <Nav />

      {/* Hero */}
      <div className={styles.heroWrap}>
        <span className={styles.heroEyebrow}>Garden Supplies Marketplace</span>
        <h1 className={styles.heroTitle}>Find pots, irrigation & tools<br />for your garden</h1>
        <p className={styles.heroLede}>
          Browse verified suppliers of pots, planters, irrigation systems, fertilizers,
          garden tools and structures across Kenya.
        </p>
        <form className={styles.heroSearch} onSubmit={handleSearch}>
          <input
            className={styles.heroSearchInput}
            type="text"
            placeholder="Search suppliers or products…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select
            className={styles.heroCountySelect}
            value={county}
            onChange={e => setCounty(e.target.value)}
          >
            <option value="">All counties</option>
            {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" className={styles.heroSearchBtn}>Search</button>
        </form>
      </div>

      {/* Category strip */}
      <div className={styles.catStrip}>
        <div className={styles.catStripInner}>
          {SUPPLY_CATS.map(({ value, label, Icon }) => (
            <button
              key={value}
              className={`${styles.catChip} ${activeCat === value ? styles.catChipActive : ''}`}
              onClick={() => setActiveCat(value)}
            >
              <Icon size={15} strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.viewToggle}>
          <p className={styles.viewMeta}>
            {loading ? 'Loading…' : `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''} found`}
          </p>
          <div className={styles.filterRow}>
            <Link to="/supplier/signup" className={styles.navBtn} style={{ fontSize: '0.82rem', padding: '6px 16px' }}>
              + List your products
            </Link>
          </div>
        </div>

        {!loading && suppliers.length === 0 && (
          <div className={styles.emptyState}>
            <h3>No suppliers found</h3>
            <p>Try a different category, county or search term.</p>
            <Link to="/supplier/signup" className={styles.ctaLink}>
              Be the first to list your products
            </Link>
          </div>
        )}

        <div className={styles.supplierGrid}>
          {suppliers.map(s => (
            <SupplierCard key={s.id} supplier={s} />
          ))}
        </div>
      </main>
    </div>
  )
}

function SupplierCard({ supplier: s }: { supplier: Supplier }) {
  return (
    <Link to={`/supplies/${s.slug}`} className={styles.supplierCard}>
      <div className={styles.supplierCardHead}>
        <div>
          <h3 className={styles.supplierName}>{s.name}</h3>
          {s.county && <p className={styles.supplierCounty}>{s.county}</p>}
        </div>
        {s.is_verified && <span className={styles.verifiedBadge}>✓ Verified</span>}
      </div>

      {s.description && (
        <p className={styles.supplierDesc}>{s.description}</p>
      )}

      {s.categories && s.categories.length > 0 && (
        <div className={styles.catTags}>
          {s.categories.map(c => (
            <span key={c} className={styles.catTag}>{c}</span>
          ))}
        </div>
      )}

      {(s.whatsapp || s.phone) && (
        <a
          href={waLink(s.whatsapp ?? s.phone!, s.name)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.waBtn}
          onClick={e => e.stopPropagation()}
        >
          <MessageCircle size={13} strokeWidth={2} />
          WhatsApp
        </a>
      )}
    </Link>
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
        <Link to="/nurseries" className={styles.navLink}>Nurseries</Link>
        <Link to="/professionals" className={styles.navLink}>Professionals</Link>
        <Link to="/supplier/signup" className={styles.navLink}>List your products</Link>
        <Link to="/login" className={styles.navLink}>Sign in</Link>
      </div>
    </nav>
  )
}
