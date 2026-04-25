import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from './Curation.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// ── Types ──────────────────────────────────────────────────────────────────
interface Plant {
  id: string
  scientific_name: string
  common_names: string[] | null
  swahili_names: string[] | null
  origin: string | null
  native_to_region: boolean | null
  native_regions: string[] | null
  tags: string[] | null
  functions: string[] | null
  min_rainfall: number | null
  max_rainfall: number | null
  altitude_min_m: number | null
  altitude_max_m: number | null
  sunlight: string | null
  soil_types: string[] | null
  water_needs: string | null
  maintenance_level: string | null
  min_height_cm: number | null
  max_height_cm: number | null
  growth_rate: string | null
  description: string | null
  confidence_score: number | null
  review_status: string
  source_refs: string[] | null
  curated_by: string | null
}

type FilterStatus = 'draft' | 'approved' | 'rejected' | 'all'
type AdminView = 'plants' | 'nurseries'

interface AdminNursery {
  id: string
  name: string
  slug: string
  county: string | null
  specialties: string[] | null
  is_verified: boolean
  is_active: boolean
  created_at: string
  owner_user_id: string | null
  profiles: { email: string } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────
function confidenceLabel(score: number | null) {
  if (score === null) return '—'
  const pct = Math.round(score * 100)
  return `${pct}%`
}

function rainfallLabel(min: number | null, max: number | null) {
  if (!min && !max) return null
  if (min && max) return `${min}–${max} mm/yr`
  if (min) return `${min}+ mm/yr`
  return `up to ${max} mm/yr`
}

function altitudeLabel(min: number | null, max: number | null) {
  if (!min && !max) return null
  if (min && max) return `${min}–${max} m`
  if (min) return `${min}+ m`
  return `up to ${max} m`
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Curation() {
  const navigate = useNavigate()
  const [adminView, setAdminView] = useState<AdminView>('plants')

  // ── Plants state ───────────────────────────────────────────────────────
  const [plants, setPlants] = useState<Plant[]>([])
  const [filter, setFilter] = useState<FilterStatus>('draft')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({ draft: 0, approved: 0, rejected: 0, total: 0 })

  // ── Nurseries state ────────────────────────────────────────────────────
  const [nurseries, setNurseries] = useState<AdminNursery[]>([])
  const [nurseriesLoading, setNurseriesLoading] = useState(false)
  const [nurseriesError, setNurseriesError] = useState<string | null>(null)
  const [nurseriesProcessing, setNurseriesProcessing] = useState<Set<string>>(new Set())

  // ── Fetch stats ────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const { data } = await supabase
      .from('plants')
      .select('review_status')
    if (!data) return
    const s = { draft: 0, approved: 0, rejected: 0, total: data.length }
    data.forEach(p => {
      if (p.review_status === 'draft') s.draft++
      else if (p.review_status === 'approved') s.approved++
      else if (p.review_status === 'rejected') s.rejected++
    })
    setStats(s)
  }, [])

  // ── Fetch plants ───────────────────────────────────────────────────────
  const fetchPlants = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('plants').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('review_status', filter)
    const { data, error } = await query
    if (error) console.error('Fetch error:', error)
    setPlants((data as Plant[]) ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchPlants(); fetchStats() }, [fetchPlants, fetchStats])

  // ── Fetch nurseries ────────────────────────────────────────────────────
  const fetchNurseries = useCallback(async () => {
    setNurseriesLoading(true)
    setNurseriesError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')
      const res = await fetch(`${API_BASE}/api/admin/nurseries`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || `Server error ${res.status}`)
      setNurseries(j.nurseries ?? [])
    } catch (err) {
      setNurseriesError(err instanceof Error ? err.message : 'Could not load nurseries.')
    } finally {
      setNurseriesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (adminView === 'nurseries') fetchNurseries()
  }, [adminView, fetchNurseries])

  // ── Toggle nursery verified / active ──────────────────────────────────
  async function patchNursery(id: string, patch: { is_verified?: boolean; is_active?: boolean }) {
    setNurseriesProcessing(prev => new Set(prev).add(id))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')
      const res = await fetch(`${API_BASE}/api/admin/nurseries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Update failed')
      setNurseries(prev => prev.map(n => n.id === id ? { ...n, ...j.nursery } : n))
    } catch (err) {
      setNurseriesError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setNurseriesProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  // ── Approve / Reject ───────────────────────────────────────────────────
  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'draft') {
    setProcessing(prev => new Set(prev).add(id))
    const { error } = await supabase
      .from('plants')
      .update({ review_status: status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setPlants(prev => prev.map(p => p.id === id ? { ...p, review_status: status } : p))
      setStats(prev => {
        const next = { ...prev }
        const plant = plants.find(p => p.id === id)
        if (plant) {
          const old = plant.review_status as keyof typeof prev
          if (old === 'draft' || old === 'approved' || old === 'rejected') next[old]--
          next[status]++
        }
        return next
      })
    }
    setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const visiblePlants = filter === 'all'
    ? plants
    : plants.filter(p => p.review_status === filter)

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.brand}>ASK BOTANIQUE</span>
          <span className={styles.divider}>›</span>
          <span className={styles.pageTitle}>Curation Queue</span>
        </div>
        <button className={styles.backLink} onClick={() => navigate('/chat')}>
          ← Back to chat
        </button>
      </div>

      {/* View toggle */}
      <div className={styles.filterBar} style={{ borderBottom: '2px solid rgba(26,93,93,0.12)', paddingBottom: 0 }}>
        <span className={styles.filterLabel}>View:</span>
        <button
          className={`${styles.filterBtn} ${adminView === 'plants' ? styles.active : ''}`}
          onClick={() => setAdminView('plants')}
        >
          Plants
        </button>
        <button
          className={`${styles.filterBtn} ${adminView === 'nurseries' ? styles.active : ''}`}
          onClick={() => setAdminView('nurseries')}
        >
          Nurseries {nurseries.length > 0 ? `(${nurseries.length})` : ''}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total species</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending review</span>
          <span className={`${styles.statValue} ${styles.draft}`}>{stats.draft}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Approved (live)</span>
          <span className={`${styles.statValue} ${styles.approved}`}>{stats.approved}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Rejected</span>
          <span className={`${styles.statValue} ${styles.rejected}`}>{stats.rejected}</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Show:</span>
        {(['draft', 'approved', 'rejected', 'all'] as FilterStatus[]).map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && ` (${stats[f]})`}
          </button>
        ))}
      </div>

      {/* RLS notice */}
      <div className={styles.notice}>
        ⚠ Ensure Supabase RLS allows authenticated admin reads on <code>plants</code> for all review_status values.
        Add policy: <code>SELECT — authenticated users where email = 'widsonnambaisi@gmail.com'</code>
      </div>

      {/* Content */}
      <div className={styles.content}>

        {/* ── NURSERIES PANEL ── */}
        {adminView === 'nurseries' && (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>§ NURSERIES</span>
              <span className={styles.sectionTitle}>Nursery Verification</span>
              <span className={styles.count}>{nurseries.length} registered</span>
            </div>
            {nurseriesError && (
              <div style={{ background: '#fdecec', color: '#8a1f1f', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                {nurseriesError}
              </div>
            )}
            {nurseriesLoading ? (
              <div className={styles.loading}>Loading nurseries…</div>
            ) : nurseries.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🌱</div>
                <div className={styles.emptyTitle}>No nurseries registered yet</div>
                <div className={styles.emptyText}>Nurseries will appear here when owners sign up at /nursery/signup</div>
              </div>
            ) : (
              nurseries.map(n => (
                <NurseryAdminCard
                  key={n.id}
                  nursery={n}
                  processing={nurseriesProcessing.has(n.id)}
                  onVerify={v   => patchNursery(n.id, { is_verified: v })}
                  onActivate={a => patchNursery(n.id, { is_active: a })}
                />
              ))
            )}
          </>
        )}

        {/* ── PLANTS PANEL ── */}
        {adminView === 'plants' && (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>§ {filter.toUpperCase()}</span>
              <span className={styles.sectionTitle}>
                {filter === 'draft' ? 'Pending Review' : filter === 'approved' ? 'Live in Database' : filter === 'rejected' ? 'Rejected' : 'All Species'}
              </span>
              <span className={styles.count}>{visiblePlants.length} {visiblePlants.length === 1 ? 'record' : 'records'}</span>
            </div>

            {loading ? (
              <div className={styles.loading}>Loading species…</div>
            ) : visiblePlants.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📋</div>
                <div className={styles.emptyTitle}>
                  {filter === 'draft' ? 'Queue is clear' : `No ${filter} species`}
                </div>
                <div className={styles.emptyText}>
                  {filter === 'draft'
                    ? 'Run the curation script to populate the queue: node scripts/curate.mjs --batch ...'
                    : 'No records match this filter.'}
                </div>
              </div>
            ) : (
              visiblePlants.map(plant => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  processing={processing.has(plant.id)}
                  onApprove={() => updateStatus(plant.id, 'approved')}
                  onReject={() => updateStatus(plant.id, 'rejected')}
                  onUndo={() => updateStatus(plant.id, 'draft')}
                />
              ))
            )}
          </>
        )}

      </div>
    </div>
  )
}

// ── Nursery Admin Card ─────────────────────────────────────────────────────
interface NurseryCardProps {
  nursery: AdminNursery
  processing: boolean
  onVerify: (v: boolean) => void
  onActivate: (a: boolean) => void
}

function NurseryAdminCard({ nursery, processing, onVerify, onActivate }: NurseryCardProps) {
  const ownerEmail = nursery.profiles?.email ?? nursery.owner_user_id ?? '—'
  return (
    <div className={styles.card} style={{ borderLeft: `4px solid ${nursery.is_verified ? '#1a5d5d' : '#f59e0b'}` }}>
      <div className={styles.cardHeader}>
        <div className={styles.nameBlock}>
          <span className={styles.scientificName}>{nursery.name}</span>
          <span className={styles.commonNames}>{nursery.county ?? 'County not set'} · {ownerEmail}</span>
        </div>
        <div className={styles.badgeRow}>
          {nursery.is_verified
            ? <span className={`${styles.badge} ${styles.approved}`}>✓ Verified</span>
            : <span className={`${styles.badge} ${styles.draft}`}>Pending</span>}
          {!nursery.is_active && (
            <span className={`${styles.badge} ${styles.rejected}`}>Deactivated</span>
          )}
        </div>
      </div>

      {nursery.specialties?.length ? (
        <div className={styles.cardBody} style={{ gridTemplateColumns: '1fr' }}>
          <div className={styles.fieldGroup} style={{ gridColumn: '1/-1' }}>
            <span className={styles.fieldLabel}>Specialties</span>
            <div className={styles.tagList}>
              {nursery.specialties.map(s => <span key={s} className={styles.tag}>{s}</span>)}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: '0.75rem', color: '#6a6a6a', padding: '0 0 10px' }}>
        Registered {new Date(nursery.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
        {' · '}<a href={`/nurseries/${nursery.slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>View public page ↗</a>
      </div>

      <div className={styles.cardActions}>
        {!nursery.is_verified ? (
          <button
            className={`${styles.btn} ${styles.btnApprove}`}
            onClick={() => onVerify(true)}
            disabled={processing}
          >
            {processing ? 'Saving…' : '✓ Verify nursery'}
          </button>
        ) : (
          <button
            className={`${styles.btn} ${styles.btnUndo}`}
            onClick={() => onVerify(false)}
            disabled={processing}
          >
            Remove verification
          </button>
        )}
        {nursery.is_active ? (
          <button
            className={`${styles.btn} ${styles.btnReject}`}
            onClick={() => onActivate(false)}
            disabled={processing}
          >
            Deactivate
          </button>
        ) : (
          <button
            className={`${styles.btn} ${styles.btnApprove}`}
            onClick={() => onActivate(true)}
            disabled={processing}
          >
            Reactivate
          </button>
        )}
      </div>
    </div>
  )
}

// ── Plant Card ─────────────────────────────────────────────────────────────
interface CardProps {
  plant: Plant
  processing: boolean
  onApprove: () => void
  onReject: () => void
  onUndo: () => void
}

function PlantCard({ plant, processing, onApprove, onReject, onUndo }: CardProps) {
  const isDraft    = plant.review_status === 'draft'
  const isApproved = plant.review_status === 'approved'
  const isRejected = plant.review_status === 'rejected'

  return (
    <div className={`${styles.card} ${styles[plant.review_status as keyof typeof styles] ?? ''}`}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.nameBlock}>
          <span className={styles.scientificName}>{plant.scientific_name}</span>
          {plant.common_names?.length ? (
            <span className={styles.commonNames}>{plant.common_names.join(' · ')}</span>
          ) : null}
          {plant.swahili_names?.length ? (
            <span className={styles.swahiliNames}>🌿 {plant.swahili_names.join(' · ')}</span>
          ) : null}
        </div>

        <div className={styles.badgeRow}>
          {plant.origin && (
            <span className={`${styles.badge} ${styles[plant.origin as keyof typeof styles] ?? ''}`}>
              {plant.origin}
            </span>
          )}
          {plant.confidence_score !== null && (
            <span className={`${styles.badge} ${styles.confidence}`}>
              ⊕ {confidenceLabel(plant.confidence_score)} confidence
            </span>
          )}
          <span className={`${styles.badge} ${styles.status} ${styles[plant.review_status as keyof typeof styles] ?? ''}`}>
            {plant.review_status}
          </span>
        </div>
      </div>

      {/* Body grid */}
      <div className={styles.cardBody}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Rainfall tolerance</span>
          <span className={`${styles.fieldValue} ${!rainfallLabel(plant.min_rainfall, plant.max_rainfall) ? styles.missing : ''}`}>
            {rainfallLabel(plant.min_rainfall, plant.max_rainfall) ?? 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Sunlight</span>
          <span className={`${styles.fieldValue} ${!plant.sunlight ? styles.missing : ''}`}>
            {plant.sunlight ?? 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Soil types</span>
          <span className={`${styles.fieldValue} ${!plant.soil_types?.length ? styles.missing : ''}`}>
            {plant.soil_types?.join(', ') ?? 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Water needs</span>
          <span className={`${styles.fieldValue} ${!plant.water_needs ? styles.missing : ''}`}>
            {plant.water_needs ?? 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Maintenance</span>
          <span className={`${styles.fieldValue} ${!plant.maintenance_level ? styles.missing : ''}`}>
            {plant.maintenance_level ?? 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Height range</span>
          <span className={`${styles.fieldValue} ${!plant.max_height_cm ? styles.missing : ''}`}>
            {plant.min_height_cm && plant.max_height_cm
              ? `${(plant.min_height_cm / 100).toFixed(0)}–${(plant.max_height_cm / 100).toFixed(0)} m`
              : plant.max_height_cm
              ? `up to ${(plant.max_height_cm / 100).toFixed(0)} m`
              : 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Growth rate</span>
          <span className={`${styles.fieldValue} ${!plant.growth_rate ? styles.missing : ''}`}>
            {plant.growth_rate ?? 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Altitude</span>
          <span className={`${styles.fieldValue} ${!altitudeLabel(plant.altitude_min_m, plant.altitude_max_m) ? styles.missing : ''}`}>
            {altitudeLabel(plant.altitude_min_m, plant.altitude_max_m) ?? 'Not specified'}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Native regions</span>
          <span className={`${styles.fieldValue} ${!plant.native_regions?.length ? styles.missing : ''}`}>
            {plant.native_regions?.join(', ') ?? 'Not specified'}
          </span>
        </div>

        {plant.tags?.length ? (
          <div className={styles.fieldGroup} style={{ gridColumn: '1 / -1' }}>
            <span className={styles.fieldLabel}>Tags</span>
            <div className={styles.tagList}>
              {plant.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
            </div>
          </div>
        ) : null}

        {plant.functions?.length ? (
          <div className={styles.fieldGroup} style={{ gridColumn: '1 / -1' }}>
            <span className={styles.fieldLabel}>Landscape functions</span>
            <div className={styles.tagList}>
              {plant.functions.map(f => <span key={f} className={styles.tag}>{f}</span>)}
            </div>
          </div>
        ) : null}
      </div>

      {/* Description */}
      {plant.description && (
        <div className={styles.description}>{plant.description}</div>
      )}

      {/* Source refs */}
      {plant.source_refs?.length ? (
        <div className={styles.sourceRefs}>
          Sources:{' '}
          {plant.source_refs.map(s => (
            <span key={s} className={styles.sourceRef}>{s}</span>
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className={styles.cardActions}>
        {isDraft && (
          <>
            <button
              className={`${styles.btn} ${styles.btnApprove}`}
              onClick={onApprove}
              disabled={processing}
            >
              {processing ? 'Saving…' : '✓ Approve'}
            </button>
            <button
              className={`${styles.btn} ${styles.btnReject}`}
              onClick={onReject}
              disabled={processing}
            >
              ✕ Reject
            </button>
          </>
        )}
        {(isApproved || isRejected) && (
          <>
            <span className={styles.actionMsg}>
              {isApproved ? '✓ Live in database' : '✕ Rejected'}
            </span>
            <button
              className={`${styles.btn} ${styles.btnUndo}`}
              onClick={() => onUndo()}
              disabled={processing}
            >
              Undo → back to draft
            </button>
          </>
        )}
      </div>
    </div>
  )
}
