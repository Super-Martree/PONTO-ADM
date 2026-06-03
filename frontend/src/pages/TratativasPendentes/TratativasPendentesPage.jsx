import { FileText } from 'lucide-react';
import styles from './TratativasPendentesPage.module.css';

const PENDENTES_CONFIG = {
  title: 'Pendentes',
  subtitle: 'Pendencias de ponto aguardando analise',
  filters: ['Funcionario', 'Periodo', 'Tipo', 'Status'],
  indicators: ['Pendentes', 'Faltas', 'Incompletos', 'Feriados trabalhados'],
  columns: ['Data', 'Funcionario', 'Tipo', 'Situacao', 'Horas', 'Observacao', 'Status', 'Acoes'],
  empty: 'Nenhuma tratativa pendente encontrada.',
};

export default function TratativasPendentesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.pageTitleBlock}>
        <h2>{PENDENTES_CONFIG.title}</h2>
        <p>{PENDENTES_CONFIG.subtitle}</p>
      </div>

      <div className={styles.filters}>
        {PENDENTES_CONFIG.filters.map((filter) => (
          <label key={filter}>
            <span>{filter}</span>
            <select defaultValue="" disabled>
              <option value="">Selecione</option>
            </select>
          </label>
        ))}
      </div>

      <div className={styles.indicators}>
        {PENDENTES_CONFIG.indicators.map((indicator) => (
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
                {PENDENTES_CONFIG.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.emptyCell} colSpan={PENDENTES_CONFIG.columns.length}>
                  <FileText size={22} opacity={0.35} />
                  {PENDENTES_CONFIG.empty}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
