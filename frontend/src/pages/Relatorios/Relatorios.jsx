import { apiFetch } from '../../utils/api';
import { Download, FileSpreadsheet, Printer, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MonthPicker from '../../components/MonthPicker/MonthPicker';
import styles from './Relatorios.module.css';

const MONTH_NAMES = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Marco',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

function todayMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMinutes(totalMinutes) {
  const value = Number(totalMinutes || 0);
  const sign = value < 0 ? '-' : '+';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function csvValue(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
}

function csvTextValue(value) {
  const text = String(value ?? '').trim();
  return csvValue(text ? `\t${text}` : '');
}

function downloadCsv(filename, lines) {
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Relatorios() {
  const [periodo, setPeriodo] = useState(todayMonth);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ano, mes] = periodo.split('-');
  const rows = data?.funcionarios || [];
  const periodoLabel = `${MONTH_NAMES[mes] || mes}/${ano}`;

  const loadRelatorio = useCallback(async () => {
    const params = new URLSearchParams({ ano, mes });

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(`/api/banco-horas?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel carregar o relatorio.');
      }

      setData(payload);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar o relatorio.');
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    loadRelatorio();
  }, [loadRelatorio]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((funcionario) => (
      String(funcionario.nome || '').toLowerCase().includes(term)
      || String(funcionario.matricula || '').toLowerCase().includes(term)
      || String(funcionario.loja || '').toLowerCase().includes(term)
      || String(funcionario.escala || '').toLowerCase().includes(term)
    ));
  }, [rows, search]);

  const summary = useMemo(() => ({
    funcionarios: visibleRows.length,
    saldoPonto: visibleRows.reduce((total, item) => total + Number(item.saldoPontoMinutos || 0), 0),
    saldoManual: visibleRows.reduce((total, item) => total + Number(item.saldoManualMinutos || 0), 0),
    saldoPeriodo: visibleRows.reduce((total, item) => total + Number(item.saldoPeriodoMinutos || 0), 0),
    comCredito: visibleRows.filter((item) => Number(item.saldoPeriodoMinutos || 0) > 0).length,
    comDebito: visibleRows.filter((item) => Number(item.saldoPeriodoMinutos || 0) < 0).length,
  }), [visibleRows]);

  function exportExcel() {
    const headers = [
      'Periodo',
      'Matricula',
      'Funcionario',
      'Loja',
      'Escala',
      'Saldo Ponto',
      'Ajuste Manual',
      'Saldo Mes',
      'Saldo Geral',
    ];
    const lines = [
      headers.map(csvValue).join(';'),
      ...visibleRows.map((funcionario) => [
        periodoLabel,
        funcionario.matricula || '',
        funcionario.nome || '',
        funcionario.loja || 'Sem loja',
        funcionario.escala || 'Sem escala',
        funcionario.saldoPonto || formatMinutes(funcionario.saldoPontoMinutos),
        funcionario.saldoManual || formatMinutes(funcionario.saldoManualMinutos),
        funcionario.saldoPeriodo || formatMinutes(funcionario.saldoPeriodoMinutos),
        funcionario.saldoGeral || formatMinutes(funcionario.saldoGeralMinutos),
      ].map(csvTextValue).join(';')),
    ];

    downloadCsv(`relatorio-saldo-funcionarios-${periodo}.csv`, lines);
  }

  function printPdf() {
    window.print();
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h2 className={styles.pageTitle}>Relatorios</h2>
          <p className={styles.pageDesc}>Saldo dos funcionarios por mes.</p>
        </div>
        <div className={styles.pageActions}>
          <button className={styles.btnSecondary} type="button" onClick={loadRelatorio} disabled={loading}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button className={styles.btnSecondary} type="button" onClick={printPdf} disabled={loading || visibleRows.length === 0}>
            <Printer size={13} /> PDF
          </button>
          <button className={styles.btnPrimary} type="button" onClick={exportExcel} disabled={loading || visibleRows.length === 0}>
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <label>
          <span>Mes do relatorio</span>
          <MonthPicker value={periodo} onChange={setPeriodo} disabled={loading} />
        </label>
        <label className={styles.searchBox}>
          <span>Buscar</span>
          <div>
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Funcionario, matricula, loja ou escala"
            />
          </div>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.printArea}>
        <div className={styles.reportTitle}>
          <div>
            <FileSpreadsheet size={18} />
            <strong>Relatorio de saldo mensal</strong>
          </div>
          <span>{periodoLabel}</span>
        </div>

        <div className={styles.indicatorGrid}>
          <div className={styles.indicatorCard}>
            <span>Funcionarios</span>
            <strong>{summary.funcionarios}</strong>
          </div>
          <div className={styles.indicatorCard}>
            <span>Saldo do ponto</span>
            <strong className={summary.saldoPonto < 0 ? styles.negative : styles.positive}>{formatMinutes(summary.saldoPonto)}</strong>
          </div>
          <div className={styles.indicatorCard}>
            <span>Ajuste manual</span>
            <strong className={summary.saldoManual < 0 ? styles.negative : styles.positive}>{formatMinutes(summary.saldoManual)}</strong>
          </div>
          <div className={styles.indicatorCard}>
            <span>Saldo do mes</span>
            <strong className={summary.saldoPeriodo < 0 ? styles.negative : styles.positive}>{formatMinutes(summary.saldoPeriodo)}</strong>
          </div>
          <div className={styles.indicatorCard}>
            <span>Com credito</span>
            <strong>{summary.comCredito}</strong>
          </div>
          <div className={styles.indicatorCard}>
            <span>Com debito</span>
            <strong>{summary.comDebito}</strong>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Matricula</th>
                  <th>Funcionario</th>
                  <th>Loja</th>
                  <th>Escala</th>
                  <th>Saldo Ponto</th>
                  <th>Ajuste Manual</th>
                  <th>Saldo Mes</th>
                  <th>Saldo Geral</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="8" className={styles.emptyState}>Carregando relatorio...</td></tr>
                )}
                {!loading && visibleRows.length === 0 && (
                  <tr><td colSpan="8" className={styles.emptyState}>Nenhum saldo encontrado.</td></tr>
                )}
                {!loading && visibleRows.map((funcionario) => (
                  <tr key={funcionario.matricula}>
                    <td className={styles.dateCell}>{funcionario.matricula}</td>
                    <td className={styles.employeeCell}>{funcionario.nome}</td>
                    <td>{funcionario.loja || 'Sem loja'}</td>
                    <td>{funcionario.escala || 'Sem escala'}</td>
                    <td className={Number(funcionario.saldoPontoMinutos || 0) < 0 ? styles.negative : styles.positive}>
                      {funcionario.saldoPonto}
                    </td>
                    <td className={Number(funcionario.saldoManualMinutos || 0) < 0 ? styles.negative : styles.positive}>
                      {funcionario.saldoManual}
                    </td>
                    <td className={Number(funcionario.saldoPeriodoMinutos || 0) < 0 ? styles.negative : styles.positive}>
                      {funcionario.saldoPeriodo}
                    </td>
                    <td className={Number(funcionario.saldoGeralMinutos || 0) < 0 ? styles.negative : styles.positive}>
                      {funcionario.saldoGeral}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
