import { Link } from 'react-router-dom'
import { CloudRain, Sun, Layers, MessageCircle, Leaf, BarChart2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import TeaserSearch from '../components/TeaserSearch'
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
    desc: 'Full sun, partial shade, or deep shade — we surface plants built for your exposure.',
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

const SCORING = [
  { label: 'Rainfall Compatibility', weight: 30, color: '#1D9E75' },
  { label: 'Sunlight Match', weight: 25, color: '#2ab885' },
  { label: 'Soil Suitability', weight: 20, color: '#4caf7d' },
  { label: 'Maintenance Level', weight: 15, color: '#6fcf97' },
  { label: 'Native Species Bonus', weight: 10, color: '#a8e6c3' },
]

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className={styles.page}>
      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.navBrand}>
            <img src="/Ask_Botanique_Logo.png" alt="Ask Botanique" />
            <span>Ask Botanique</span>
          </div>
          <div className={styles.navLinks}>
            {user ? (
              <Link to="/chat" className="btn btn-white">
                Open Chat →
              </Link>
            ) : (
              <>
                <Link to="/login" className={styles.navLink}>Sign in</Link>
                <Link to="/signup" className="btn btn-white">Get started free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>🌍 Built for East African landscaping</div>
          <h1 className={styles.heroHeading}>
            Plant intelligence platform<br />
            <span className={styles.heroAccent}>for tropical countries</span>
          </h1>
          <p className={styles.heroSubtext}>
            Describe your rainfall, soil, and sunlight. Ask Botanique scores thousands of East African species
            in real time and explains exactly why each plant fits — or doesn't.
          </p>
          {user ? (
            <div className={styles.heroActions}>
              <Link to="/chat" className="btn btn-white btn-lg">Open Chat →</Link>
            </div>
          ) : (
            <TeaserSearch />
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Everything you need to choose the right plant</h2>
            <p className={styles.sectionSubtitle}>
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

      {/* ── SCORING BREAKDOWN ── */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionInner}>
          <div className={styles.splitLayout}>
            <div className={styles.splitText}>
              <h2 className={styles.sectionTitleAlt}>
                Transparent scoring — no black boxes
              </h2>
              <p className={styles.sectionSubtitleAlt}>
                Every recommendation is backed by a weighted algorithm derived from
                Kenya Horticultural Society data and real field observations from
                Botanique Designers projects.
              </p>
              <Link to="/signup" className="btn btn-primary" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                Try it now →
              </Link>
            </div>
            <div className={styles.scoreVisual}>
              {SCORING.map(s => (
                <div key={s.label} className={styles.scoreRow}>
                  <span className={styles.scoreLabel}>{s.label}</span>
                  <div className={styles.scoreBarWrap}>
                    <div
                      className={styles.scoreBar}
                      style={{ width: `${s.weight * 3}%`, background: s.color }}
                    />
                    <span className={styles.scoreWeight}>{s.weight}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaHeading}>Ready to find the perfect plants?</h2>
          <p className={styles.ctaSubtext}>
            Join landscapers and gardeners using Ask Botanique across East Africa.
          </p>
          {user ? (
            <Link to="/chat" className="btn btn-white btn-lg">Open Chat →</Link>
          ) : (
            <Link to="/signup" className="btn btn-white btn-lg">Create your free account</Link>
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
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} Widson Ambaisi · Built with field knowledge from East Africa
          </p>
        </div>
      </footer>
    </div>
  )
}
