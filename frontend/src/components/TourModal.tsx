import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import styles from './TourModal.module.css'

interface Props {
  onClose: () => void
  onGetStarted?: () => void
}

const STEPS = [
  {
    label: '01 / 03',
    title: 'Describe your site',
    body: 'Type your conditions in plain English — rainfall, soil, sunlight, location. No codes or spreadsheets.',
    visual: (
      <div className={styles.mockSearch}>
        <div className={styles.mockInput}>
          <span className={styles.mockText}>
            Trees for clay soil, 900 mm rainfall, full sun in Nairobi
          </span>
          <span className={styles.mockCursor} />
        </div>
        <div className={styles.mockBtn}>Ask →</div>
      </div>
    ),
  },
  {
    label: '02 / 03',
    title: 'Get scored plant matches',
    body: 'Every result comes with a 0–100 suitability score and clear reasons — so you can justify choices to clients instantly.',
    visual: (
      <div className={styles.mockCards}>
        {[
          { name: 'Acacia tortilis', common: 'Umbrella Thorn', score: 92, tag: 'Native' },
          { name: 'Delonix regia', common: 'Flamboyant Tree', score: 78, tag: 'Ornamental' },
          { name: 'Terminalia mantaly', common: 'Madagascar Almond', score: 65, tag: 'Shade tree' },
        ].map(p => (
          <div key={p.name} className={styles.mockCard}>
            <div className={styles.mockCardLeft}>
              <p className={styles.mockSci}>{p.name}</p>
              <p className={styles.mockCommon}>{p.common}</p>
              <span className={styles.mockTag}>{p.tag}</span>
            </div>
            <span
              className={styles.mockScore}
              style={{ background: p.score >= 80 ? '#1a5d5d' : '#3E9B9B' }}
            >
              {p.score}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: '03 / 03',
    title: 'Ask follow-up questions',
    body: 'Narrow down, compare, or pivot — ask the AI anything about the results. It reasons across 171+ East African species.',
    visual: (
      <div className={styles.mockChat}>
        <div className={styles.mockBubbleUser}>Which of these needs the least watering?</div>
        <div className={styles.mockBubbleAI}>
          <span className={styles.mockAiIcon}>🌿</span>
          <p><strong>Acacia tortilis</strong> is your best pick for low water needs — it thrives on 400–600 mm annually and is deeply drought-adapted to East African savannah conditions.</p>
        </div>
        <div className={styles.mockBubbleUser}>Any concerns for a rooftop setting?</div>
        <div className={styles.mockBubbleAIShort}>
          <span className={styles.mockAiIcon}>🌿</span>
          <p>Root depth could be an issue — consider <strong>Terminalia mantaly</strong> instead, which has a compact root system suited to contained planting.</p>
        </div>
      </div>
    ),
  },
]

export default function TourModal({ onClose, onGetStarted }: Props) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) setStep(s => s + 1)
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [step, onClose])

  const current = STEPS[step]

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className={styles.stepLabel}>{current.label}</div>

        <div className={styles.visual}>{current.visual}</div>

        <div className={styles.content}>
          <h2 className={styles.title}>{current.title}</h2>
          <p className={styles.body}>{current.body}</p>
        </div>

        <div className={styles.nav}>
          <button
            className={styles.navBtn}
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>

          <div className={styles.dots}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === step ? styles.dotActive : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <button
              className={styles.navBtn}
              onClick={() => setStep(s => s + 1)}
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              className={styles.ctaBtn}
              onClick={() => { onClose(); onGetStarted?.() }}
            >
              Try it now — it's free →
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
