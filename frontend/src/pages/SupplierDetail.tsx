import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Package, Droplets, Bug, Wheat, Wrench, Building2, LayoutGrid,
  Phone, Mail, Globe, MessageCircle, ChevronLeft, ShoppingBag,
} from 'lucide-react'
import styles from './Supplies.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const SUPPLY_CATS = [
  { value: '',           label: 'All products',  Icon: LayoutGrid },
  { value: 'pots',       label: 'Pots',          Icon: Package    },
  { value: 'irrigation', label: 'Irrigation',    Icon: Droplets   },
  { value: 'pesticides', label: 'Pesticides',    Icon: Bug        },
  { value: 'fertilizer', label: 'Fertilizers',   Icon: Wheat      },
  { value: 'tools',      label: 'Tools',         Icon: Wrench     },
  { value: 'structures', label: 'Structures',    Icon: Building2  },
]

const PRICE_UNIT_LABELS: Record<string, string> = {
  each: 'each',
  per_m: '/m',
  per_kg: '/kg',
  per_bag: '/bag',
  per_roll: '/roll',
  per_litre: '/litre',
  per_set: '/set',
}

interface Product {
  id: string
  name: string
  category: string
  subcategory: string | null
  description: string | null
  price_kes: number | null
  price_unit: string
  material: string | null
  size_options: string[] | null
  image_urls: string[] | null
  in_stock: boolean
  supplier_id: string
}

interface SupplierFull {
  id: string
  name: string
  slug: string
  description: string | null
  county: string | null
  categories: string[]
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  is_verified: boolean
  products: Product[]
}

function waLink(num: string, name: string) {
  const msg = encodeURIComponent(`Hi ${name}, I found you on Ask Botanique and I'm interested in your products.`)
  return `https://wa.me/${num.replace(/\D/g, '')}?text=${msg}`
}

function productWaLink(num: string, supplierName: string, productName: string) {
  const msg = encodeURIComponent(`Hi ${supplierName}, I found you on Ask Botanique. I'm interested in: ${productName}. Could you share availability and pricing?`)
  return `https://wa.me/${num.replace(/\D/g, '')}?text=${msg}`
}

export default function SupplierDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [supplier, setSupplier] = useState<SupplierFull | null>(null)
  const [loading, setLoading]   = useState(true)
  const [activeCat, setActiveCat] = useState('')

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetch(`${API_BASE}/api/supplies/${slug}`)
      .then(r => r.json())
      .then(data => setSupplier(data.supplier ?? data))
      .catch(() => setSupplier(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className={styles.loadingPage}>Loading…</div>

  if (!supplier) {
    return (
      <div className={styles.page}>
        <Nav />
        <main className={styles.profilePage}>
          <div className={styles.emptyState}>
            <h3>Supplier not found</h3>
            <p>This supplier may have moved or been removed.</p>
            <Link to="/supplies" className={styles.ctaLink}>Browse all suppliers</Link>
          </div>
        </main>
      </div>
    )
  }

  const contact = supplier.whatsapp ?? supplier.phone
  const visibleProducts = activeCat
    ? supplier.products.filter(p => p.category === activeCat)
    : supplier.products

  return (
    <div className={styles.page}>
      <Nav />
      <main className={styles.profilePage}>
        <Link to="/supplies" className={styles.backLink}>
          <ChevronLeft size={16} strokeWidth={2} />
          All suppliers
        </Link>

        {/* Profile header */}
        <div className={styles.profileHeader}>
          <div className={styles.profileHeaderLeft}>
            <h1 className={styles.profileName}>
              {supplier.name}
              {supplier.is_verified && (
                <span className={styles.verifiedBadge} style={{ marginLeft: 10, fontSize: '0.7rem', verticalAlign: 'middle' }}>
                  ✓ Verified
                </span>
              )}
            </h1>

            <div className={styles.profileMeta}>
              {supplier.county && <span>📍 {supplier.county}</span>}
              {supplier.categories.length > 0 && (
                <div className={styles.catTags} style={{ margin: 0 }}>
                  {supplier.categories.map(c => (
                    <span key={c} className={styles.catTag}>{c}</span>
                  ))}
                </div>
              )}
            </div>

            {supplier.description && (
              <p className={styles.profileDesc}>{supplier.description}</p>
            )}
          </div>

          <div className={styles.profileContacts}>
            {contact && (
              <a
                href={waLink(contact, supplier.name)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.profileWaBtn}
              >
                <MessageCircle size={16} strokeWidth={2} />
                WhatsApp
              </a>
            )}
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className={styles.profileContactLink}>
                <Phone size={14} strokeWidth={1.8} />
                {supplier.phone}
              </a>
            )}
            {supplier.email && (
              <a href={`mailto:${supplier.email}`} className={styles.profileContactLink}>
                <Mail size={14} strokeWidth={1.8} />
                {supplier.email}
              </a>
            )}
            {supplier.website && (
              <a href={supplier.website} target="_blank" rel="noopener noreferrer" className={styles.profileContactLink}>
                <Globe size={14} strokeWidth={1.8} />
                Website
              </a>
            )}
          </div>
        </div>

        {/* Product category filter */}
        {supplier.products.length > 0 && (
          <>
            <div className={styles.catStrip} style={{ margin: '0 -24px 18px', borderRadius: 0 }}>
              <div className={styles.catStripInner}>
                {SUPPLY_CATS.map(({ value, label, Icon }) => {
                  const count = value
                    ? supplier.products.filter(p => p.category === value).length
                    : supplier.products.length
                  if (value !== '' && count === 0) return null
                  return (
                    <button
                      key={value}
                      className={`${styles.catChip} ${activeCat === value ? styles.catChipActive : ''}`}
                      onClick={() => setActiveCat(value)}
                    >
                      <Icon size={14} strokeWidth={1.8} />
                      {label}
                      <span style={{ opacity: 0.7, fontWeight: 500 }}>({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={styles.productGrid}>
              {visibleProducts.map(p => (
                <ProductCard key={p.id} product={p} supplier={supplier} />
              ))}
            </div>

            {visibleProducts.length === 0 && (
              <div className={styles.emptyState}>
                <h3>No products in this category yet</h3>
              </div>
            )}
          </>
        )}

        {supplier.products.length === 0 && (
          <div className={styles.emptyState}>
            <ShoppingBag size={40} color="var(--color-primary)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
            <h3>No products listed yet</h3>
            <p>This supplier hasn't listed any products yet. Contact them directly via WhatsApp.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function ProductCard({ product: p, supplier: s }: { product: Product; supplier: SupplierFull }) {
  const contact = s.whatsapp ?? s.phone
  const imgSrc = p.image_urls && p.image_urls.length > 0 ? p.image_urls[0] : null

  return (
    <div className={styles.productCard}>
      <div className={styles.productImgWrap}>
        {imgSrc
          ? <img src={imgSrc} alt={p.name} />
          : <Package size={36} strokeWidth={1.3} color="var(--color-primary)" style={{ opacity: 0.35 }} />
        }
      </div>

      <div className={styles.productBody}>
        <h4 className={styles.productName}>{p.name}</h4>
        {p.subcategory && <p className={styles.productSub}>{p.subcategory}</p>}

        {p.price_kes != null && (
          <p className={styles.productPrice}>
            KES {p.price_kes.toLocaleString()}
            <span className={styles.productUnit}>{PRICE_UNIT_LABELS[p.price_unit] ?? p.price_unit}</span>
          </p>
        )}

        {p.material && <span className={styles.productMaterial}>{p.material}</span>}

        {p.size_options && p.size_options.length > 0 && (
          <p className={styles.productSizes}>Sizes: {p.size_options.join(' · ')}</p>
        )}

        {!p.in_stock && <p className={styles.outOfStock}>Out of stock</p>}

        {contact && (
          <div className={styles.productFooter}>
            <span className={styles.supplierLink}>{s.name}</span>
            <a
              href={productWaLink(contact, s.name, p.name)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.waBtn}
            >
              <MessageCircle size={12} strokeWidth={2} />
              Enquire
            </a>
          </div>
        )}
      </div>
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
        <Link to="/supplies" className={styles.navLink}>Supplies</Link>
        <Link to="/nurseries" className={styles.navLink}>Nurseries</Link>
        <Link to="/supplier/signup" className={styles.navLink}>List your products</Link>
        <Link to="/login" className={styles.navLink}>Sign in</Link>
      </div>
    </nav>
  )
}
