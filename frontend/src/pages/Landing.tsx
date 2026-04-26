import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CloudRain, Sun, Layers, MessageCircle, Leaf, BarChart2, ArrowRight, MapPin, Menu, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import TeaserSearch, { TeaserSearchHandle } from '../components/TeaserSearch'
import TourModal from '../components/TourModal'
import { BotaniqueMark } from '../components/BotaniqueMark'
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

const CATEGORIES = [
  { slug: 'indigenous',      label: 'Indigenous Trees' },
  { slug: 'flowering',       label: 'Flowering' },
  { slug: 'fruit',           label: 'Fruit & Edibles' },
  { slug: 'shade',           label: 'Shade Trees' },
  { slug: 'hedge',           label: 'Hedging' },
  { slug: 'indoor',          label: 'Indoor Plants' },
  { slug: 'drought-tolerant',label: 'Drought-tolerant' },
  { slug: 'medicinal',       label: 'Medicinal' },
  { slug: 'ornamental',      label: 'Ornamental' },
  { slug: 'climber',         label: 'Climbers' },
]

const PHOTO_CARDS = [
  {
    tag: 'indigenous',
    label: 'Indigenous Trees',
    sub: '158 species',
    img: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=600&q=80',
  },
  {
    tag: 'flowering',
    label: 'Flowering',
    sub: '117 species',
    img: 'https://images.unsplash.com/photo-1444930694458-01babf71870c?auto=format&fit=crop&w=600&q=80',
  },
  {
    tag: 'fruit',
    label: 'Fruit & Edibles',
    sub: '112 species',
    img: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?auto=format&fit=crop&w=600&q=80',
  },
  {
    tag: 'shade',
    label: 'Shade Trees',
    sub: '129 species',
    img: 'https://images.unsplash.com/photo-1476231682828-37e571bc172f?auto=format&fit=crop&w=600&q=80',
  },
]

const BENEFITS = [
  {
    icon: BarChart2,
    title: 'Get precise recommendations',
    desc: 'We score thousands of plants against your exact rainfall, soil, and sunlight. No generic lists — every result is ranked and explained.',
  },
  {
    icon: Leaf,
    title: 'Botanically verified species',
    desc: 'Every species is reviewed and sourced from East African field data. Our AI only recommends what\'s in our curated database of 682 species.',
  },
  {
    icon: MapPin,
    title: 'Find nurseries near you',
    desc: 'Connect with verified nurseries across Kenya who stock the plants you specify. From Nairobi to Mombasa.',
  },
]

const COUNTIES = [
  'Nairobi', 'Kiambu', 'Nakuru', 'Mombasa', 'Kisumu',
  'Nanyuki', 'Eldoret', 'Nyeri', 'Machakos', 'Laikipia',
]

export default function Landing() {
  const { user } = useAuth()
  const [tourOpen, setTourOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
          <Link to="/" className={styles.navBrand}>
            <BotaniqueMark size={34} variant="paper" />
            <span>Ask Botanique</span>
          </Link>

          {/* Desktop links */}
          <div className={styles.navLinks}>
            <Link to="/explore" className={styles.navLink}>Browse plants</Link>
            <Link to="/nurseries" className={styles.navLink}>Nurseries</Link>
            <Link to="/professionals" className={styles.navLink}>Professionals</Link>
            <Link to="/supplies" className={styles.navLink}>Supplies</Link>
            <Link to="/nursery/signup" className={styles.navLink}>List your nursery</Link>
            {user ? (
              <Link to="/chat" className={styles.navLink}>Chat</Link>
            ) : (
              <>
                <Link to="/login" className={styles.navLink}>Sign in</Link>
                <Link to="/signup" className={styles.navCta}>Get started free</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className={styles.mobileMenu} onClick={() => setMenuOpen(false)}>
            <Link to="/explore" className={styles.mobileLink}>Browse plants</Link>
            <Link to="/nurseries" className={styles.mobileLink}>Nurseries</Link>
            <Link to="/professionals" className={styles.mobileLink}>Professionals</Link>
            <Link to="/supplies" className={styles.mobileLink}>Supplies</Link>
            <Link to="/nursery/signup" className={styles.mobileLink}>List your nursery</Link>
            <div className={styles.mobileDivider} />
            {user ? (
              <Link to="/chat" className={styles.mobileLink}>Chat</Link>
            ) : (
              <>
                <Link to="/login" className={styles.mobileLink}>Sign in</Link>
                <Link to="/signup" className={styles.mobileLinkCta}>Get started free →</Link>
              </>
            )}
          </div>
        )}
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
                <Link to="/explore" className={styles.btnGhost}>Browse plants →</Link>
              </div>
            ) : (
              <div className={styles.heroActions}>
                <Link to="/signup" className={styles.btnPrimary}>Get started free</Link>
                <Link to="/explore" className={styles.btnGhost}>Browse plants →</Link>
              </div>
            )}
            <p className={styles.heroHint}>
              <button className={styles.hintLink} onClick={() => setTourOpen(true)}>See how it works →</button>
            </p>
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

      {/* ── TRUST STRIP — Pattern 5 ── */}
      <div className={styles.trustStrip}>
        <span>{speciesCount ? `${speciesCount}+` : '682+'} species</span>
        <span className={styles.trustDot}>·</span>
        <span>Curated for East Africa</span>
        <span className={styles.trustDot}>·</span>
        <span>AI-powered recommendations</span>
        <span className={styles.trustDot}>·</span>
        <span>Free to start</span>
      </div>

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

      {/* ── CATEGORY STRIP — Pattern 2 ── */}
      <section className={styles.catStrip}>
        <div className={styles.catStripInner}>
          {CATEGORIES.map(c => (
            <Link key={c.slug} to={`/explore?tags=${c.slug}`} className={styles.catChip}>
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── 4-UP PHOTO CARDS — Pattern 3 ── */}
      <section className={styles.photoCards}>
        <div className={styles.photoCardsInner}>
          {PHOTO_CARDS.map(card => (
            <Link key={card.tag} to={`/explore?tags=${card.tag}`} className={styles.photoCard}>
              <img src={card.img} alt={card.label} loading="lazy" className={styles.photoCardImg} />
              <div className={styles.photoCardOverlay} />
              <div className={styles.photoCardLabel}>
                <p className={styles.photoCardTitle}>{card.label}</p>
                <p className={styles.photoCardCount}>{card.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── TEASER SEARCH ── */}
      <section className={styles.teaserSection} ref={teaserSectionRef} id="try-it-free">
        <div className={styles.teaserSectionInner}>
          <p className={styles.teaserSectionLabel}>TRY IT FREE</p>
          <h2 className={styles.teaserSectionTitle}>Get your first plant recommendation — right now</h2>
          <p className={styles.teaserSectionSub}>
            Describe your site or name a plant. No account needed.
          </p>
          <TeaserSearch ref={teaserRef} />
        </div>
      </section>

      {/* ── BENEFITS — Pattern 4 ── */}
      <section className={styles.benefitSection}>
        <div className={styles.benefitInner}>
          <div className={styles.benefitHeader}>
            <span className={styles.benefitLabel}>Why professionals choose us</span>
            <h2 className={styles.benefitTitle}>The fastest way to specify plants<br />for East African sites</h2>
          </div>
          <div className={styles.benefitGrid}>
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className={styles.benefitCard}>
                <div className={styles.benefitIcon}><Icon size={22} strokeWidth={1.8} /></div>
                <h3 className={styles.benefitCardTitle}>{title}</h3>
                <p className={styles.benefitCardDesc}>{desc}</p>
              </div>
            ))}
          </div>
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

      {/* ── COUNTY CHIPS — Pattern 6 ── */}
      <section className={styles.countiesSection}>
        <div className={styles.sectionInner}>
          <div className={styles.countiesHeader}>
            <h2 className={styles.countiesTitle}>Find nurseries in your county</h2>
            <p className={styles.countiesSub}>Verified nurseries stocking East African species — ready to deliver.</p>
          </div>
          <div className={styles.countyChips}>
            {COUNTIES.map(c => (
              <Link key={c} to={`/nurseries?county=${encodeURIComponent(c)}`} className={styles.countyChip}>
                {c}
              </Link>
            ))}
            <Link to="/nurseries" className={styles.countyChipAll}>Browse all →</Link>
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
            <Link to="/explore" className={styles.ctaBtn}>Browse plants →</Link>
          ) : (
            <div className={styles.ctaActions}>
              <Link to="/signup" className={styles.ctaBtn}>Create your free account</Link>
              <Link to="/explore" className={styles.ctaBtnSecondary}>Browse plants →</Link>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <BotaniqueMark size={30} variant="light" />
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
