import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import styles from './Nursery.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface Nursery {
  id: string
  slug: string
  name: string
  county: string | null
  is_verified: boolean
  is_active: boolean
}

interface PlantSuggestion {
  id: string
  scientific_name: string
  common_names: string[] | null
}

interface InventoryRow {
  id: string
  plant_id: string
  quantity_available: number
  price_kes: number | null
  price_unit: string
  container_size: string | null
  is_available: boolean
  lead_time_days: number | null
  seasonal_note: string | null
  last_updated: string
  plants: {
    id: string
    scientific_name: string
    common_names: string[] | null
    image_url: string | null
    thumbnail_url: string | null
  } | null
}

const PRICE_UNITS = ['seedling', 'sapling', 'mature', 'cutting', 'per_m2', 'per_kg']

export default function NurseryDashboard() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [token, setToken]         = useState<string | null>(null)
  const [nursery, setNursery]     = useState<Nursery | null>(null)
  const [items, setItems]         = useState<InventoryRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Add-row state
  const [searchQ, setSearchQ]                   = useState('')
  const [suggestions, setSuggestions]           = useState<PlantSuggestion[]>([])
  const [selectedPlant, setSelectedPlant]       = useState<PlantSuggestion | null>(null)
  const [addQty, setAddQty]                     = useState('20')
  const [addPrice, setAddPrice]                 = useState('')
  const [addUnit, setAddUnit]                   = useState('seedling')
  const [addContainer, setAddContainer]         = useState('5L bag')
  const [adding, setAdding]                     = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?next=/nursery/dashboard'); return }
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const t = session?.access_token ?? null
        if (!t) throw new Error('Not signed in.')
        if (cancelled) return
        setToken(t)

        const meRes = await fetch(`${API_BASE}/api/nurseries/me`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (!meRes.ok) throw new Error(`Could not load nursery (${meRes.status})`)
        const meJson = await meRes.json()
        if (!meJson?.nursery) {
          if (!cancelled) navigate('/nursery/signup', { replace: true })
          return
        }
        if (cancelled) return
        setNursery(meJson.nursery)

        const invRes = await fetch(`${API_BASE}/api/nurseries/${meJson.nursery.id}/inventory`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        const invJson = await invRes.json()
        if (!invRes.ok) throw new Error(invJson?.error || 'Could not load inventory')
        if (!cancelled) setItems(invJson.inventory ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unexpected error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, user, navigate])

  // Plant search debouncer (uses existing /api/explore?q=...)
  useEffect(() => {
    if (selectedPlant) { setSuggestions([]); return }
    if (!searchQ.trim()) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/explore?q=${encodeURIComponent(searchQ.trim())}&limit=8`)
        const j = await res.json()
        const list: PlantSuggestion[] = (j?.plants ?? []).map((p: PlantSuggestion) => ({
          id: p.id,
          scientific_name: p.scientific_name,
          common_names: p.common_names,
        }))
        setSuggestions(list)
      } catch {/* noop */}
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQ, selectedPlant])

  function pickPlant(p: PlantSuggestion) {
    setSelectedPlant(p)
    setSearchQ(p.scientific_name)
    setSuggestions([])
  }

  function clearPicked() {
    setSelectedPlant(null)
    setSearchQ('')
  }

  async function addInventory() {
    if (!nursery || !token || !selectedPlant) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/nurseries/${nursery.id}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          plant_id: selectedPlant.id,
          quantity_available: parseInt(addQty, 10) || 0,
          price_kes: addPrice ? parseInt(addPrice, 10) : null,
          price_unit: addUnit,
          container_size: addContainer || null,
          is_available: true,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Could not add item.')
      // Reload inventory
      const invRes = await fetch(`${API_BASE}/api/nurseries/${nursery.id}/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const invJson = await invRes.json()
      setItems(invJson.inventory ?? [])
      // Reset add row
      clearPicked()
      setAddPrice('')
      setAddQty('20')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item.')
    } finally {
      setAdding(false)
    }
  }

  async function patchItem(id: string, patch: Partial<InventoryRow>) {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Update failed.')
      setItems(prev => prev.map(it => (it.id === id ? { ...it, ...j.item, plants: it.plants } : it)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    }
  }

  async function deleteItem(id: string) {
    if (!token) return
    if (!confirm('Remove this plant from your inventory?')) return
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Delete failed.')
      }
      setItems(prev => prev.filter(it => it.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  if (authLoading || loading) {
    return <div className={styles.loadingPage}>Loading dashboard…</div>
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
          {nursery && (
            <Link to={`/nurseries/${nursery.slug}`} className={styles.navBtn}>View public page →</Link>
          )}
        </div>
      </nav>

      <div className={styles.dashWrap}>
        {error && <div className={styles.errorBox} style={{ marginBottom: 18 }}>{error}</div>}

        {nursery && (
          <header className={styles.dashHeader}>
            <div>
              <h1>
                {nursery.name}
                {nursery.is_verified
                  ? <span className={styles.verifiedBadge}>✓ Verified</span>
                  : <span className={styles.pendingBadge}>Pending verification</span>}
              </h1>
              <div className={styles.meta}>
                {nursery.county ? `${nursery.county} · ` : ''}
                {items.length} plant{items.length !== 1 ? 's' : ''} in inventory
              </div>
            </div>
          </header>
        )}

        {/* Add-plant row */}
        <div className={styles.addRow}>
          <div className={`${styles.fieldGroup} grow ${styles.suggestList} ${styles.grow}`} style={{ flex: 1, minWidth: 240, position: 'relative' }}>
            <label className={styles.label}>Add a plant</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Search by Latin or common name…"
              value={searchQ}
              onChange={e => { setSelectedPlant(null); setSearchQ(e.target.value) }}
            />
            {suggestions.length > 0 && (
              <div className={styles.suggestPanel}>
                {suggestions.map(s => (
                  <div key={s.id} className={styles.suggestItem} onClick={() => pickPlant(s)}>
                    <span className={styles.suggestSci}>{s.scientific_name}</span>
                    {s.common_names?.length ? (
                      <span className={styles.suggestComm}>{s.common_names.slice(0, 2).join(', ')}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.fieldGroup} style={{ width: 100 }}>
            <label className={styles.label}>Qty</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={addQty}
              onChange={e => setAddQty(e.target.value)}
            />
          </div>
          <div className={styles.fieldGroup} style={{ width: 130 }}>
            <label className={styles.label}>Price (KES)</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={addPrice}
              onChange={e => setAddPrice(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className={styles.fieldGroup} style={{ width: 130 }}>
            <label className={styles.label}>Unit</label>
            <select className={styles.input} value={addUnit} onChange={e => setAddUnit(e.target.value)}>
              {PRICE_UNITS.map(u => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className={styles.fieldGroup} style={{ width: 130 }}>
            <label className={styles.label}>Container</label>
            <input
              className={styles.input}
              type="text"
              value={addContainer}
              onChange={e => setAddContainer(e.target.value)}
              placeholder="5L bag"
            />
          </div>
          <button
            className={styles.submitBtn}
            disabled={!selectedPlant || adding}
            onClick={addInventory}
            style={{ height: 44 }}
          >
            {adding ? 'Adding…' : 'Add to inventory'}
          </button>
        </div>

        {/* Inventory table */}
        {items.length === 0 ? (
          <div className={styles.emptyInv}>
            <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--color-primary)' }}>
              No plants in your inventory yet.
            </p>
            <p style={{ margin: 0 }}>Search above to add your first species.</p>
          </div>
        ) : (
          <table className={styles.invTable}>
            <thead>
              <tr>
                <th>Plant</th>
                <th>Qty</th>
                <th>Price (KES)</th>
                <th>Unit</th>
                <th>Container</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td>
                    <div className={styles.invSci}>{it.plants?.scientific_name ?? '—'}</div>
                    {it.plants?.common_names?.length
                      ? <div className={styles.invComm}>{it.plants.common_names.slice(0, 2).join(', ')}</div>
                      : null}
                  </td>
                  <td>
                    <input
                      className={styles.invInput}
                      type="number"
                      min="0"
                      defaultValue={it.quantity_available}
                      onBlur={e => {
                        const v = parseInt(e.target.value, 10)
                        if (!Number.isNaN(v) && v !== it.quantity_available) {
                          patchItem(it.id, { quantity_available: v })
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.invInput}
                      type="number"
                      min="0"
                      defaultValue={it.price_kes ?? ''}
                      onBlur={e => {
                        const raw = e.target.value
                        const v = raw === '' ? null : parseInt(raw, 10)
                        if (v !== it.price_kes) patchItem(it.id, { price_kes: v })
                      }}
                    />
                  </td>
                  <td>
                    <select
                      className={styles.invSelect}
                      defaultValue={it.price_unit}
                      onChange={e => patchItem(it.id, { price_unit: e.target.value })}
                    >
                      {PRICE_UNITS.map(u => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      className={styles.invInput}
                      type="text"
                      defaultValue={it.container_size ?? ''}
                      style={{ width: 110 }}
                      onBlur={e => {
                        const v = e.target.value || null
                        if (v !== it.container_size) patchItem(it.id, { container_size: v })
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      defaultChecked={it.is_available}
                      onChange={e => patchItem(it.id, { is_available: e.target.checked })}
                    />
                  </td>
                  <td>
                    <button className={`${styles.miniBtn} ${styles.miniBtnDanger}`} onClick={() => deleteItem(it.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
