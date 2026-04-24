import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CloudRain, Sun, Layers, MessageCircle, Leaf, BarChart2, ArrowRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import TeaserSearch, { TeaserSearchHandle } from '../components/TeaserSearch'
import TourModal from '../components/TourModal'
import styles from './Landing.module.css'

const FEATURES = [
  {
    icon: CloudRain,
    title: 'Rainfall Intelligence',
    desc: 'Match plants to your site\'s annual rainfall — from arid 400mm to wet 2000mm+.',
    query: 'Drought-tolerant trees for a site with 500mm annual rainfall in full sun',
  },
  {
    icon: Sun,
    title: 'Sunlight Matching',
    desc: 'Full sun, partial shade, or deep shade — we surface plants built for your exact exposure.',
    query: 'What plants suit partial shade with loam soil in Nairobi?',
  },
  {
    icon: Layers,
    title: 'Soil Compatibility',
    desc: 'Clay, loam, or sandy — our scoring weights soil fit so your plants actually thrive.',
    query: 'What trees and shrubs suit clay soil with 900mm rainfall in full sun?',
  },
  {
    icon: MessageCircle,
    title: 'AI-Powered Chat',
    desc: 'Ask anything in plain English. Our assistant reasons across thousands of East African species.',
    query: 'What are the best low-maintenance plants for a Nairobi courtyard garden?',
  },
  {
    icon: Leaf,
    title: 'Native Species First',
    desc: 'Ecologically adapted plants get a bonus score — less maintenance, more resilience.',
    query: 'Show me native East African groundcovers for partial shade',
  },
  {
    icon: BarChart2,
    title: 'Scored & Explained',
    desc: 'Every recommendation comes with a 0–100 suitability score and clear match reasons.',
    query: 'Fast-growing hedges for full sun, loam soil, 900mm annual rainfall',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Ask Botanique helped me specify the right groundcovers for a shaded Westlands courtyard in under 5 minutes.',
    name: 'James K.',
    role: 'Landscape Architect, Nairobi',
  },
  {
    quote: 'The scoring system is exactly what I needed to justify plant choices to clients. No more guesswork.',
    name: 'Amina L.',
    role: 'Garden Designer, Mombasa',
  },
  {
    quote: 'Used the free tier to plan a rooftop garden — the rainfall intelligence was spot on for Kisumu.',
    name: 'David M.',
    role: 'Homeowner, Kisumu',
  },
]

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=380&q=80',
  'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=380&q=80',
]

export default function Landing() {
  const { user } = useAuth()
  const [tourOpen, setTourOpen] = useState(false)
  const [speciesCount, setSpeciesCount] = useState<number | null>(null)
  const teaserRef = useRef<TeaserSearchHandle>(null)
  const teaserSectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL ?? ''
    fetch(`${API_BASE}/api/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.approved_species_count && setSpeciesCount(d.approved_species_count))
      .catch(() => {})
  }, [])

  function handleGetStarted() {
    teaserSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => teaserRef.current?.focus(), 500)
  }

  function handleFeatureClick(query: string) {
    teaserSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => {
      teaserRef.current?.prefill(query)
      teaserRef.current?.focus()
    }, 400)
  }

  return (
    <div className={styles.page}>
      {tourOpen && (
        <TourModal
          onClose={() => setTourOpen(false)}
          onGetStarted={handleGetStarted}
        />
      )}

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.navBrand}>
            <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
            <span>Ask Botanique</span>
          </div>
          <div className={styles.navLinks}>
            {user ? (
              <Link to="/chat" className={styles.navCta}>Open Chat →</Link>
            ) : (
              <>
                <Link to="/login" className={styles.navLink}>Sign in</Link>
                <Link to="/signup" className={styles.navCta}>Get started free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO — split layout ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>

          {/* Left column */}
          <div className={styles.heroText}>
            <h1 className={styles.heroHeading}>
              Stop guessing.<br />
              <span className={styles.heroAccent}>Start specifying.</span>
            </h1>
            <p className={styles.heroSubtext}>
              Describe your rainfall, soil, and sunlight. Ask Botanique scores
              thousands of East African species in real time and explains exactly
              why each plant fits — or doesn't.
            </p>
            {user ? (
              <div className={styles.heroActions}>
                <Link to="/chat" className={styles.btnPrimary}>Open Chat <ArrowRight size={16} /></Link>
              </div>
            ) : (
              <div className={styles.heroActions}>
                <Link to="/signup" className={styles.btnPrimary}>Get started free</Link>
                <button className={styles.btnGhost} onClick={() => setTourOpen(true)}>See how it works →</button>
              </div>
            )}
            <div className={styles.heroStats}>
              <span>{speciesCount ? `${speciesCount}+ Species` : '600+ Species'}</span>
              <span className={styles.statDot}>·</span>
              <span>5,000 target</span>
              <span className={styles.statDot}>·</span>
              <span>Free forever</span>
            </div>
          </div>

          {/* Right column — botanical mosaic */}
          <div className={styles.heroVisual}>
            <div className={styles.mosaic}>
              <div className={styles.mosaicMain}>
                <img src={HERO_IMAGES[0]} alt="Tropical plant" loading="lazy" />
              </div>
              <div className={styles.mosaicRight}>
                <div className={styles.mosaicTop}>
                  <img src={HERO_IMAGES[1]} alt="Botanical garden" loading="lazy" />
                </div>
                <div className={styles.mosaicBottom}>
                  <img src={HERO_IMAGES[2]} alt="Acacia tree" loading="lazy" />
                </div>
              </div>
              <div className={styles.floatBubble}>
                <span className={styles.floatScore}>92/100</span>
                <span className={styles.floatLabel}>Acacia tortilis</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE BAND ── */}
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.marqueeTrack}>
          {[0, 1].map(i => (
            <div key={i} className={styles.marqueeContent}>
              <span>East African Plants</span><span className={styles.marqueeDot}>◆</span>
              <span>AI-Powered Intelligence</span><span className={styles.marqueeDot}>◆</span>
              <span>Professional Grade</span><span className={styles.marqueeDot}>◆</span>
              <span>{speciesCount ? `${speciesCount}+ Species` : '600+ Species'}</span><span className={styles.marqueeDot}>◆</span>
              <span>Scored &amp; Explained</span><span className={styles.marqueeDot}>◆</span>
              <span>Nairobi · Kenya</span><span className={styles.marqueeDot}>◆</span>
              <span>Free to Start</span><span className={styles.marqueeDot}>◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── TEASER SEARCH ── */}
      <section className={styles.teaserSection} ref={teaserSectionRef} id="try-it-free">
        <div className={styles.teaserSectionInner}>
          <p className={styles.sectionNum}>§ 01 — Try It Free</p>
          <p className={styles.teaserSectionLabel}>TRY IT FREE</p>
          <h2 className={styles.teaserSectionTitle}>Get your first plant recommendation — right now</h2>
          <p className={styles.teaserSectionSub}>
            Describe your site or name a plant. No account needed.
          </p>
          <TeaserSearch ref={teaserRef} />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionInner}>
          <div className={styles.featuresHeader}>
            <p className={styles.sectionNum}>§ 02 — Intelligence</p>
            <h2 className={styles.sectionTitle}>Everything you need to choose<br />the right plant</h2>
            <p className={styles.sectionSub}>
              Stop guessing. Our multi-factor scoring engine and AI chat put decades of
              field knowledge at your fingertips.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map(({ icon: Icon, title, desc, query }, idx) => (
              <button
                key={title}
                className={styles.featureCard}
                onClick={() => handleFeatureClick(query)}
              >
                <div className={styles.featureCardTop}>
                  <div className={styles.featureIconWrap}>
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                  <span className={styles.featureNum}>{String(idx + 1).padStart(2, '0')} / Feature</span>
                </div>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{desc}</p>
                <span className={styles.featureTry}>Try it →</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className={styles.proofSection}>
        <div className={styles.sectionInner}>
          <p className={styles.sectionNum}>§ 03 — Trusted By</p>
          <p className={styles.proofLabel}>Trusted by landscapers across East Africa</p>
          <div className={styles.testimonialGrid}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} className={styles.testimonialCard}>
                <p className={styles.testimonialQuote}>"{t.quote}"</p>
                <div className={styles.testimonialAuthor}>
                  <span className={styles.testimonialName}>{t.name}</span>
                  <span className={styles.testimonialRole}>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaHeading}>Start recommending the right plants today</h2>
          <p className={styles.ctaSubtext}>
            Join landscapers and gardeners using Ask Botanique across East Africa.
          </p>
          {user ? (
            <Link to="/chat" className={styles.ctaBtn}>Open Chat →</Link>
          ) : (
            <Link to="/signup" className={styles.ctaBtn}>Create your free account</Link>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
            <div>
              <span className={styles.footerBrandName}>Ask Botanique</span>
              <span className={styles.footerTagline}>Built for East African landscaping</span>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <a
              href="https://www.botaniquedesigners.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerOutbound}
            >
              Botanique Designers ↗
            </a>
          </div>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} Botanique Designers · Nairobi, Kenya
          </p>
        </div>
      </footer>
    </div>
  )
}
