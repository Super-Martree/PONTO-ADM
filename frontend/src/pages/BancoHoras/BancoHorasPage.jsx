import { apiFetch } from '../../utils/api';
import { Clock, MinusCircle, PlusCircle, RefreshCw, Search, Wallet, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import MonthPicker from '../../components/MonthPicker/MonthPicker';
import styles from './BancoHorasPage.module.css';

function formatMinutes(totalMinutes) {
  const value = Number(totalMinutes || 0);
  const sign = value < 0 ? '-' : '+';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDateBr(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}-${month}-${year}` : value || '-';
}

function minutesFromTime(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,3})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    return null;
  }
  const total = (hours * 60) + minutes;
  return total > 0 && total <= 1440 ? total : null;
}

function todayMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function BancoHorasPage() {
  const [periodo, setPeriodo] = useState(todayMonth);
  const [data, setData] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);
  const [selectedMatricula, setSelectedMatricula] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState('');
  const [manual, setManual] = useState({
    funcionarioId: '',
    data: new Date().toISOString().slice(0, 10),
    tipo: 'credito',
    horas: '',
    descricao: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [ano, mes] = periodo.split('-');

  const loadFuncionarios = useCallback(async () => {
    const response = await apiFetch('/api/funcionarios', { cache: 'no-store', credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'Nao foi possivel carregar funcionarios.');
    }
    setFuncionarios((payload.funcionarios || []).filter((funcionario) => funcionario.ativo));
  }, []);

  const loadBancoHoras = useCallback(async () => {
    const params = new URLSearchParams({ ano, mes });
    if (selectedMatricula) params.set('matricula', selectedMatricula);

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(`/api/banco-horas?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel carregar banco de horas.');
      }
      setData(payload);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar banco de horas.');
    } finally {
      setLoading(false);
    }
  }, [ano, mes, selectedMatricula]);

  useEffect(() => {
    loadFuncionarios().catch((err) => setError(err.message || 'Nao foi possivel carregar funcionarios.'));
  }, [loadFuncionarios]);

  useEffect(() => {
    loadBancoHoras();
  }, [loadBancoHoras]);

  const rows = data?.funcionarios || [];
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((funcionario) => (
      String(funcionario.nome || '').toLowerCase().includes(term)
      || String(funcionario.matricula || '').toLowerCase().includes(term)
      || String(funcionario.loja || '').toLowerCase().includes(term)
    ));
  }, [rows, search]);

  const manualFuncionario = useMemo(() => (
    funcionarios.find((funcionario) => String(funcionario.id) === String(manual.funcionarioId)) || null
  ), [funcionarios, manual.funcionarioId]);

  const summary = useMemo(() => ({
    saldoPeriodo: rows.reduce((total, item) => total + Number(item.saldoPeriodoMinutos || 0), 0),
    saldoManual: rows.reduce((total, item) => total + Number(item.saldoManualMinutos || 0), 0),
    comCredito: rows.filter((item) => Number(item.saldoPeriodoMinutos || 0) > 0).length,
    comDebito: rows.filter((item) => Number(item.saldoPeriodoMinutos || 0) < 0).length,
  }), [rows]);

  function updateManual(field, value) {
    setManual((current) => ({ ...current, [field]: value }));
  }

  async function submitManual(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const minutos = minutesFromTime(manual.horas);
    if (!minutos) {
      setError('Informe horas no formato HH:MM, ate 24:00.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch('/api/banco-horas/lancamentos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionarioId: manual.funcionarioId,
          data: manual.data,
          tipo: manual.tipo,
          minutos,
          descricao: manual.descricao,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel salvar o lancamento.');
      }
      setMessage('Lancamento manual registrado.');
      setManual((current) => ({ ...current, horas: '', descricao: '' }));
      setModalOpen(false);
      await loadBancoHoras();
    } catch (err) {
      setError(err.message || 'Nao foi possivel salvar o lancamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Banco de Horas</h2>
          <p>Saldo por funcionario a partir dos registros de ponto e ajustes manuais.</p>
        </div>
        <div className={styles.headerActions}>
          <MonthPicker value={periodo} onChange={setPeriodo} />
          <button type="button" onClick={() => setModalOpen(true)}>
            <PlusCircle size={13} /> Adicionar
          </button>
          <button type="button" onClick={loadBancoHoras} disabled={loading}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.success}>{message}</p>}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <Wallet size={18} />
          <small>Saldo do periodo</small>
          <strong className={summary.saldoPeriodo < 0 ? styles.negative : styles.positive}>{formatMinutes(summary.saldoPeriodo)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <Clock size={18} />
          <small>Ajuste manual</small>
          <strong className={summary.saldoManual < 0 ? styles.negative : styles.positive}>{formatMinutes(summary.saldoManual)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <PlusCircle size={18} />
          <small>Com credito</small>
          <strong>{summary.comCredito}</strong>
        </div>
        <div className={styles.summaryCard}>
          <MinusCircle size={18} />
          <small>Com debito</small>
          <strong>{summary.comDebito}</strong>
        </div>
      </div>

      <div className={styles.tools}>
        <label className={styles.searchBox}>
          <Search size={14} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar funcionario, matricula ou loja" />
        </label>
        <select value={selectedMatricula} onChange={(event) => setSelectedMatricula(event.target.value)}>
          <option value="">Todos os funcionarios</option>
          {funcionarios.map((funcionario) => (
            <option key={funcionario.id} value={funcionario.matricula}>
              {funcionario.nome} - {funcionario.matricula}
            </option>
          ))}
        </select>
      </div>

      <section className={styles.tablePanel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Funcionario</th>
              <th>Loja</th>
              <th>Ponto</th>
              <th>Manual</th>
              <th>Periodo</th>
              <th>Geral</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" className={styles.empty}>Carregando banco de horas...</td></tr>
            )}
            {!loading && visibleRows.length === 0 && (
              <tr><td colSpan="6" className={styles.empty}>Nenhum saldo encontrado.</td></tr>
            )}
            {!loading && visibleRows.map((funcionario) => (
              <Fragment key={funcionario.matricula}>
                <tr onClick={() => setExpanded((current) => current === funcionario.matricula ? '' : funcionario.matricula)}>
                  <td>
                    <strong>{funcionario.nome}</strong>
                    <span>{funcionario.matricula}</span>
                  </td>
                  <td>{funcionario.loja || 'Sem loja'}</td>
                  <td className={Number(funcionario.saldoPontoMinutos || 0) < 0 ? styles.negative : styles.positive}>{funcionario.saldoPonto}</td>
                  <td className={Number(funcionario.saldoManualMinutos || 0) < 0 ? styles.negative : styles.positive}>{funcionario.saldoManual}</td>
                  <td className={Number(funcionario.saldoPeriodoMinutos || 0) < 0 ? styles.negative : styles.positive}>{funcionario.saldoPeriodo}</td>
                  <td className={Number(funcionario.saldoGeralMinutos || 0) < 0 ? styles.negative : styles.positive}>{funcionario.saldoGeral}</td>
                </tr>
                {expanded === funcionario.matricula && (
                  <tr className={styles.detailRow}>
                    <td colSpan="6">
                      <div className={styles.movements}>
                        {(funcionario.movimentos || []).length === 0 && <span>Nenhum movimento no periodo.</span>}
                        {(funcionario.movimentos || []).length > 0 && (
                          <table className={styles.movementsTable}>
                            <thead>
                              <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Horas</th>
                                <th>Motivo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(funcionario.movimentos || []).map((movimento, index) => (
                                <tr key={`${movimento.origem}-${movimento.id || movimento.data}-${index}`}>
                                  <td>{formatDateBr(movimento.data)}</td>
                                  <td>
                                    <span className={styles.movementType}>{movimento.origem === 'manual' ? 'Manual' : 'Ponto'}</span>
                                  </td>
                                  <td className={Number(movimento.minutos || 0) < 0 ? styles.negative : styles.positive}>
                                    {movimento.saldo || formatMinutes(movimento.minutos)}
                                  </td>
                                  <td>{movimento.descricao || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      {modalOpen && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={() => setModalOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Lancamento manual" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Lancamento manual</h3>
              <button type="button" className={styles.iconButton} onClick={() => setModalOpen(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <form className={styles.formPanel} onSubmit={submitManual}>
              <label>
                Funcionario
                <select value={manual.funcionarioId} onChange={(event) => updateManual('funcionarioId', event.target.value)} required>
                  <option value="">Selecione</option>
                  {funcionarios.map((funcionario) => (
                    <option key={funcionario.id} value={funcionario.id}>{funcionario.nome} - {funcionario.matricula}</option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input type="date" value={manual.data} onChange={(event) => updateManual('data', event.target.value)} required />
              </label>
              <label>
                Tipo
                <select value={manual.tipo} onChange={(event) => updateManual('tipo', event.target.value)}>
                  <option value="credito">Adicionar saldo</option>
                  <option value="debito">Retirar saldo</option>
                </select>
              </label>
              <label>
                Horas
                <input value={manual.horas} onChange={(event) => updateManual('horas', event.target.value)} placeholder="02:30" required />
              </label>
              <label>
                Motivo
                <textarea value={manual.descricao} onChange={(event) => updateManual('descricao', event.target.value)} maxLength={250} required />
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" disabled={saving || !manualFuncionario}>
                  {manual.tipo === 'credito' ? <PlusCircle size={14} /> : <MinusCircle size={14} />}
                  {saving ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
