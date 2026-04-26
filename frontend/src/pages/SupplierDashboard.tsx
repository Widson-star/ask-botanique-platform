import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Package, Trash2, Plus, X } from 'lucide-react'
import styles from './Supplies.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const CATEGORIES = ['pots','irrigation','pesticides','fertilizer','tools','structures'] as const
type Category = typeof CATEGORIES[number]

const SUBCATEGORIES: Record<Category, string[]> = {
  pots:       ['Concrete pot','Plastic pot','Ceramic pot','Terracotta pot','Wooden planter','Fibreglass pot','Grow bag','Hanging basket','Window box'],
  irrigation: ['Drip line','Sprinkler head','Irrigation pipe','Ball valve','Filter','Timer','Drip tape','Emitter','Connector'],
  pesticides: ['Insecticide','Fungicide','Herbicide','Nematicide','Rodenticide','Organic spray','Fumigant'],
  fertilizer: ['Organic compost','NPK blend','CAN','DAP','Foliar feed','Slow-release pellets','Liquid fertilizer','Bone meal','Manure'],
  tools:      ['Hand trowel','Spade','Fork','Pruner','Loppers','Hedge shears','Watering can','Wheelbarrow','Lawn mower','Hoe','Rake'],
  structures: ['Greenhouse','Shade net','Trellis','Pergola','Raised bed','Cold frame','Storage shed','Fencing','Bamboo stakes'],
}

const MATERIALS: string[] = ['concrete','plastic','ceramic','terracotta','wood','fibreglass','grow_bag','hanging_basket','metal','bamboo','polythene']

const PRICE_UNITS = ['each','per_m','per_kg','per_bag','per_roll','per_litre','per_set']

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
  in_stock: boolean
}

interface SupplierProfile {
  id: string
  name: string
  slug: string
  county: string | null
  categories: string[]
  whatsapp: string | null
  phone: string | null
}

const EMPTY_FORM = {
  name: '',
  category: '' as Category | '',
  subcategory: '',
  description: '',
  price_kes: '',
  price_unit: 'each',
  material: '',
  size_options: '',
}

export default function SupplierDashboard() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)

  const [supplier, setSupplier]   = useState<SupplierProfile | null>(null)
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAddForm, setShowAdd] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null)
    })
  }, [user])

  const fetchData = useCallback(async (tok: string) => {
    setLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/api/suppliers/me`, { headers: { 'Authorization': `Bearer ${tok}` } }),
        fetch(`${API_BASE}/api/suppliers/me/products`, { headers: { 'Authorization': `Bearer ${tok}` } }),
      ])
      const sData = await sRes.json()
      const pData = await pRes.json()
      setSupplier(sRes.ok ? (sData.supplier ?? sData) : null)
      setProducts(pRes.ok ? (Array.isArray(pData) ? pData : (pData.products ?? [])) : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) fetchData(token)
  }, [token, fetchData])

  useEffect(() => {
    if (!authLoading && !user) navigate('/login?next=/supplier/dashboard')
    if (!loading && !supplier && user) navigate('/supplier/signup')
  }, [authLoading, user, loading, supplier, navigate])

  async function toggleStock(product: Product) {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ in_stock: !product.in_stock }),
      })
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, in_stock: !p.in_stock } : p))
      }
    } catch { /* silent */ }
  }

  async function deleteProduct(id: string) {
    if (!token) return
    if (!confirm('Delete this product?')) return
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) setProducts(prev => prev.filter(p => p.id !== id))
    } catch { /* silent */ }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !form.name.trim() || !form.category) {
      setSaveError('Product name and category are required.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        subcategory: form.subcategory || null,
        description: form.description.trim() || null,
        price_kes: form.price_kes ? parseFloat(form.price_kes) : null,
        price_unit: form.price_unit,
        material: form.material || null,
        size_options: form.size_options
          ? form.size_options.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      }

      const res = await fetch(`${API_BASE}/api/suppliers/me/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Could not add product.')

      setProducts(prev => [j.product ?? j, ...prev])
      setForm(EMPTY_FORM)
      setShowAdd(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) return <div className={styles.loadingPage}>Loading…</div>
  if (!supplier) return null // redirect handled above

  const subOptions = form.category ? (SUBCATEGORIES[form.category as Category] ?? []) : []

  return (
    <div className={styles.page}>
      <Nav supplierSlug={supplier.slug} />
      <div className={styles.dashMain}>
        {/* Header */}
        <div className={styles.dashHeader}>
          <div>
            <h1 className={styles.dashTitle}>{supplier.name}</h1>
            <p className={styles.dashMeta}>
              {supplier.county && `📍 ${supplier.county} · `}
              {products.length} product{products.length !== 1 ? 's' : ''} listed
            </p>
          </div>
          <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>
            {showAddForm ? <><X size={14} style={{ verticalAlign: 'middle' }} /> Cancel</> : <><Plus size={14} style={{ verticalAlign: 'middle' }} /> Add product</>}
          </button>
        </div>

        {/* Add product form */}
        {showAddForm && (
          <div className={styles.addProductForm}>
            <h2 className={styles.formSectionTitle}>New product</h2>
            {saveError && <div className={styles.errorBox} style={{ marginBottom: 14 }}>{saveError}</div>}
            <form onSubmit={handleAddProduct}>
              <div className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Product name *</label>
                    <input
                      type="text"
                      placeholder="e.g. 10-inch Terracotta Pot"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Category *</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value as Category | '', subcategory: '' }))}
                      required
                    >
                      <option value="">Select category…</option>
                      {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Subcategory</label>
                    <select
                      value={form.subcategory}
                      onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                      disabled={subOptions.length === 0}
                    >
                      <option value="">Select subcategory…</option>
                      {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Material</label>
                    <select value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))}>
                      <option value="">None / not applicable</option>
                      {MATERIALS.map(m => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{m.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Price (KES)</label>
                    <input
                      type="number"
                      placeholder="e.g. 850"
                      min={0}
                      value={form.price_kes}
                      onChange={e => setForm(f => ({ ...f, price_kes: e.target.value }))}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Price unit</label>
                    <select value={form.price_unit} onChange={e => setForm(f => ({ ...f, price_unit: e.target.value }))}>
                      {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Sizes available (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. 6 inch, 10 inch, 15 inch, 20 inch"
                    value={form.size_options}
                    onChange={e => setForm(f => ({ ...f, size_options: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    placeholder="Brief product description…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    maxLength={1000}
                  />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={saving}>
                  {saving ? 'Adding…' : 'Add product'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Products table */}
        {products.length === 0 && !showAddForm ? (
          <div className={styles.emptyState}>
            <Package size={40} color="var(--color-primary)" strokeWidth={1.3} style={{ marginBottom: 12 }} />
            <h3>No products yet</h3>
            <p>Add your first product to start appearing in the marketplace.</p>
            <button className={styles.ctaLink} style={{ border: 'none', cursor: 'pointer' }} onClick={() => setShowAdd(true)}>
              Add your first product
            </button>
          </div>
        ) : products.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.productTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price (KES)</th>
                  <th>Material</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <strong style={{ display: 'block', color: 'var(--color-primary)' }}>{p.name}</strong>
                      {p.subcategory && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.subcategory}</span>}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{p.category}</td>
                    <td>
                      {p.price_kes != null ? (
                        <>{p.price_kes.toLocaleString()} <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{p.price_unit}</span></>
                      ) : '—'}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{p.material?.replace('_', ' ') ?? '—'}</td>
                    <td>
                      <button
                        className={`${styles.stockToggle} ${p.in_stock ? styles.inStock : styles.outStock}`}
                        onClick={() => toggleStock(p)}
                      >
                        {p.in_stock ? 'In stock' : 'Out of stock'}
                      </button>
                    </td>
                    <td>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => deleteProduct(p.id)}
                        title="Delete product"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div style={{ marginTop: 28, fontSize: '0.83rem', color: '#9ca3af', textAlign: 'center' }}>
          <Link to={`/supplies/${supplier.slug}`} style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>
            View your public profile →
          </Link>
        </div>
      </div>
    </div>
  )
}

function Nav({ supplierSlug }: { supplierSlug: string }) {
  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
        <span>Ask Botanique</span>
      </Link>
      <div className={styles.navRight}>
        <Link to={`/supplies/${supplierSlug}`} className={styles.navLink}>Public profile</Link>
        <Link to="/supplies" className={styles.navLink}>Browse supplies</Link>
      </div>
    </nav>
  )
}
