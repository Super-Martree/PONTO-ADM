import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { API_ACTIVITY_EVENT } from '../../utils/apiMonitor';
import styles from './ApiStatusModal.module.css';

export default function ApiStatusModal() {
  const [activity, setActivity] = useState({
    loading: false,
    title: 'Consultando banco de dados',
    error: null,
  });

  useEffect(() => {
    function handleActivity(event) {
      setActivity((current) => ({
        ...current,
        ...event.detail,
        error: event.detail.error || (event.detail.loading ? null : current.error),
      }));
    }

    window.addEventListener(API_ACTIVITY_EVENT, handleActivity);
    return () => window.removeEventListener(API_ACTIVITY_EVENT, handleActivity);
  }, []);

  if (activity.error) {
    return (
      <div className={styles.overlay} role="presentation">
        <div className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="api-error-title">
          <div className={styles.iconWrapError}>
            <AlertTriangle size={24} />
          </div>
          <div className={styles.content}>
            <h2 id="api-error-title">{activity.error.title}</h2>
            <p>{activity.error.message}</p>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setActivity((current) => ({ ...current, error: null }))}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (!activity.loading) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.loadingBox} role="status" aria-live="polite" aria-label={activity.title}>
        <img className={styles.loadingLogo} src="/martri-mascote.png" alt="" />
      </div>
    </div>
  );
}
