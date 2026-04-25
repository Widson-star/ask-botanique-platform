import ReactMarkdown from 'react-markdown'
import type { ChatMessage as ChatMessageType } from '../types'
import styles from './ChatMessage.module.css'

interface Props {
  message: ChatMessageType
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.user : styles.assistant}`}>
      <div className={styles.avatar}>
        {isUser ? '👤' : '🌿'}
      </div>
      <div className={styles.bubble}>
        <div className={styles.text}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {message.plants && message.plants.length > 0 && (
          <div className={styles.plants}>
            <p className={styles.plantsLabel}>
              {message.plants[0]?.suitability_score != null
                ? 'Recommended plants:'
                : 'Plants from our database:'}
            </p>
            <div className={styles.plantGrid}>
              {message.plants.map(({ plant, suitability_score, match_reasons, warnings }) => (
                <div key={plant.id} className={styles.plantCard}>
                  {plant.thumbnail_url && (
                    <img src={plant.thumbnail_url} alt={plant.scientific_name} className={styles.plantImg} />
                  )}
                  <div className={styles.plantInfo}>
                    <div className={styles.plantHeader}>
                      <div>
                        <p className={styles.plantName}>{plant.scientific_name}</p>
                        {plant.common_names?.length > 0 && (
                          <p className={styles.plantCommon}>{plant.common_names[0]}</p>
                        )}
                      </div>
                      {suitability_score != null && (
                        <span
                          className={styles.score}
                          style={{ background: scoreColor(suitability_score) }}
                        >
                          {suitability_score}
                        </span>
                      )}
                    </div>
                    {match_reasons.length > 0 && (
                      <ul className={styles.reasons}>
                        {match_reasons.slice(0, 3).map((r, i) => (
                          <li key={i} className={styles.reason}>✓ {r}</li>
                        ))}
                      </ul>
                    )}
                    {warnings.length > 0 && (
                      <ul className={styles.warnings}>
                        {warnings.slice(0, 2).map((w, i) => (
                          <li key={i} className={styles.warning}>⚠ {w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <span className={styles.time}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function scoreColor(score: number): string {
  if (score >= 80) return '#1a5d5d'
  if (score >= 60) return '#4caf7d'
  if (score >= 40) return '#f59e0b'
  return '#dc2626'
}
