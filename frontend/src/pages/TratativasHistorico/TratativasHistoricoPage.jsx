import { FileText } from 'lucide-react';
import styles from './TratativasHistoricoPage.module.css';

const HISTORICO_CONFIG = {
  title: 'Historico',
  subtitle: 'Consulte tratativas ja resolvidas',
  filters: ['Funcionario', 'Periodo', 'Tipo', 'Resultado'],
  indicators: ['Resolvidas', 'Aprovadas', 'Rejeitadas', 'Compensadas'],
  columns: ['Data', 'Funcionario', 'Tipo', 'Resultado', 'Observacao', 'Resolvido em', 'Acoes'],
  empty: 'Nenhuma tratativa encontrada no historico.',
};

export default function TratativasHistoricoPage() {
  return (
    <div className={styles.page}>
      <div className={styles.pageTitleBlock}>
        <h2>{HISTORICO_CONFIG.title}</h2>
        <p>{HISTORICO_CONFIG.subtitle}</p>
      </div>

      <div className={styles.filters}>
        {HISTORICO_CONFIG.filters.map((filter) => (
          <label key={filter}>
            <span>{filter}</span>
            <select defaultValue="" disabled>
              <option value="">Selecione</option>
            </select>
          </label>
        ))}
      </div>

      <div className={styles.indicators}>
        {HISTORICO_CONFIG.indicators.map((indicator) => (
          <div key={indicator} className={styles.indicatorCard}>
            <span>{indicator}</span>
            <strong>-</strong>
          </div>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                {HISTORICO_CONFIG.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.emptyCell} colSpan={HISTORICO_CONFIG.columns.length}>
                  <FileText size={22} opacity={0.35} />
                  {HISTORICO_CONFIG.empty}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
