import { Download, FileText, Filter } from 'lucide-react';
import styles from './Relatorios.module.css';

export default function Relatorios() {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h2 className={styles.pageTitle}>Relatorios</h2>
          <p className={styles.pageDesc}>Extracao e acompanhamento dos registros de ponto.</p>
        </div>
        <div className={styles.pageActions}>
          <button className={styles.btnSecondary}><Filter size={13} /> Filtrar</button>
          <button className={styles.btnPrimary}><Download size={13} /> Exportar</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tableHeader}>
          <span>Relatorio</span>
          <span>Periodo</span>
          <span>Formato</span>
          <span>Status</span>
          <span>Acoes</span>
        </div>
        <div className={styles.emptyState}>
          <FileText size={28} opacity={0.3} />
          <span>Nenhum relatorio gerado</span>
        </div>
      </div>
    </div>
  );
}
