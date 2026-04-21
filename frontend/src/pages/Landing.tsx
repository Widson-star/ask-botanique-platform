import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudRain, Sun, Layers, MessageCircle, Leaf, BarChart2, ArrowRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import TeaserSearch from '../components/TeaserSearch'
import TourModal from '../components/TourModal'
import styles from './Landing.module.css'

const FEATURES = [
  {
    icon: CloudRain,
    title: 'Rainfall Intelligence',
    desc: 'Match plants to your site\'s annual rainfall — from arid 400mm to wet 2000mm+.',
  },
  {
    icon: Sun,
    title: 'Sunlight Matching',
    desc: 'Full sun, partial shade, or deep shade — we surface plants built for your exact exposure.',
  },
  {
    icon: Layers,
    title: 'Soil Compatibility',
    desc: 'Clay, loam, or sandy — our scoring weights soil fit so your plants actually thrive.',
  },
  {
    icon: MessageCircle,
    title: 'AI-Powered Chat',
    desc: 'Ask anything in plain English. Our assistant reasons across thousands of East African species.',
  },
  {
    icon: Leaf,
    title: 'Native Species First',
    desc: 'Ecologically adapted plants get a bonus score — less maintenance, more resilience.',
  },
  {
    icon: BarChart2,
    title: 'Scored & Explained',
    desc: 'Every recommendation comes with a 0–100 suitability score and clear match reasons.',
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

  return (
    <div className={styles.page}>
      {tourOpen && <TourModal onClose={() => setTourOpen(false)} />}

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
            <div className={styles.heroBadge}>
              🌍 Built for East African landscaping
            </div>
            <h1 className={styles.heroHeading}>
              The plant intelligence<br />
              <span className={styles.heroAccent}>platform for tropical</span><br />
              <span className={styles.heroAccent}>landscapes</span>
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
              <span>171+ Species</span>
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
              {/* Floating stat bubble */}
              <div className={styles.floatBubble}>
                <span className={styles.floatScore}>8/10</span>
                <span className={styles.floatLabel}>Acacia tortilis</span>
              </div>
              {/* Floating badge */}
              <div className={styles.floatBadge}>🌿 Native species</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TEASER SEARCH — own section ── */}
      <section className={styles.teaserSection}>
        <div className={styles.teaserSectionInner}>
          <p className={styles.teaserSectionLabel}>TRY IT FREE</p>
          <h2 className={styles.teaserSectionTitle}>Get your first plant recommendation — right now</h2>
          <p className={styles.teaserSectionSub}>
            Describe your site or name a plant. No account needed.
          </p>
          <TeaserSearch />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionInner}>
          <div className={styles.featuresHeader}>
            <h2 className={styles.sectionTitle}>Everything you need to choose<br />the right plant</h2>
            <p className={styles.sectionSub}>
              Stop guessing. Our multi-factor scoring engine and AI chat put decades of
              field knowledge at your fingertips.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className={styles.featureCard}>
                <div className={styles.featureIconWrap}>
                  <Icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className={styles.proofSection}>
        <div className={styles.sectionInner}>
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
            <span>Ask Botanique</span>
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
