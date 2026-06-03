import { formatDateBr } from '../../../utils/date';
import styles from './RecordsTable.module.css';

function TimeCell({ label, value }) {
  return (
    <div className={styles.timeCell}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function getStatusClass(row) {
  if (row.status === 'Completo') return styles.statusOk;
  if (row.status === 'Feriado') return styles.statusHoliday;
  if (row.status === 'Feriado Trabalhado') return styles.statusOk;
  if (row.status === 'Em andamento') return styles.statusProgress;
  return styles.statusPending;
}

export default function RecordsTable({ rows = [] }) {
  const tableRows = rows.length > 0 ? rows : [];

  return (
    <div className={styles.tableShell}>
      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Escala</th>
              <th>Entrada</th>
              <th>Saida</th>
              <th>Entrada</th>
              <th>Saida</th>
              <th>Esperado</th>
              <th>Trabalhado</th>
              <th>Saldo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td className={styles.dateCell} colSpan={10}>Nenhum registro encontrado.</td>
              </tr>
            ) : tableRows.map((row) => {
              return (
                <tr key={row.data}>
                  <td className={styles.dateCell}>{formatDateBr(row.data)}</td>
                  <td className={styles.metricCell}>{row.escala || 'Sem escala'}</td>
                  <td><TimeCell label="E" value={row.entrada1} /></td>
                  <td><TimeCell label="S" value={row.saida1} /></td>
                  <td><TimeCell label="E" value={row.entrada2} /></td>
                  <td><TimeCell label="S" value={row.saida2} /></td>
                  <td className={styles.metricCell}>{row.esperado || '00:00'}</td>
                  <td className={styles.metricCell}>{row.trabalhado || '00:00'}</td>
                  <td className={row.saldoMinutos === null ? styles.statusCell : Number(row.saldoMinutos || 0) >= 0 ? styles.balanceCell : styles.balanceNegative}>
                    {row.saldo || '-'}
                  </td>
                  <td className={getStatusClass(row)}>{row.status || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
