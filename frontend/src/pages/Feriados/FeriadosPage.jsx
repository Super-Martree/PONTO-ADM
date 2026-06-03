import { CalendarDays, Edit2, Plus, Power } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MonthPicker from '../../components/MonthPicker/MonthPicker';
import { formatDateBr, parseDateBrInput, toBrDateInput } from '../../utils/date';
import styles from './FeriadosPage.module.css';

const EMPTY_FORM = {
  data: '',
  descricao: '',
  ativo: true,
};

function getMonth(value) {
  return String(value || '').slice(5, 7);
}

function getYear(value) {
  return String(value || '').slice(0, 4);
}

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function FeriadosPage() {
  const [feriados, setFeriados] = useState([]);
  const [filters, setFilters] = useState({
    periodo: currentMonth(),
    status: '',
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadFeriados = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/feriados', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar feriados.');
      }

      setFeriados(data.feriados || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeriados();
  }, [loadFeriados]);

  const filteredFeriados = useMemo(() => {
    const [filterYear, filterMonth] = String(filters.periodo || '').split('-');

    return feriados.filter((item) => {
      const status = item.ativo ? 'ativo' : 'inativo';
      return (!filterYear || getYear(item.data) === filterYear)
        && (!filterMonth || getMonth(item.data) === filterMonth)
        && (!filters.status || status === filters.status);
    });
  }, [feriados, filters]);

  const indicators = useMemo(() => {
    const [filterYear, filterMonth] = String(filters.periodo || '').split('-');
    const active = feriados.filter((item) => item.ativo);
    const inYear = active.filter((item) => getYear(item.data) === filterYear);
    const inMonth = filterMonth ? inYear.filter((item) => getMonth(item.data) === filterMonth) : [];
    const next = [...active].sort((a, b) => a.data.localeCompare(b.data))[0];

    return [
      ['Feriados no ano', String(inYear.length).padStart(2, '0')],
      ['Feriados no mes', String(inMonth.length).padStart(2, '0')],
      ['Proximo feriado', next ? formatDateBr(next.data) : '-'],
      ['Ativos', String(active.length).padStart(2, '0')],
    ];
  }, [feriados, filters.periodo]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(false);
  }

  function openNewFeriado() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(true);
  }

  function editFeriado(feriado) {
    setEditingId(feriado.id);
    setForm({
      data: toBrDateInput(feriado.data),
      descricao: feriado.descricao,
      ativo: feriado.ativo,
    });
    setModalOpen(true);
  }

  async function saveFeriado(event) {
    event.preventDefault();
    setFeedback(null);
    setSaving(true);

    try {
      const response = await fetch(editingId ? `/api/feriados/${editingId}` : '/api/feriados', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          data: parseDateBrInput(form.data),
          descricao: form.descricao,
          ativo: form.ativo,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel salvar feriado.');
      }

      setFeedback({ type: 'success', message: data.message });
      resetForm();
      await loadFeriados();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(feriado) {
    setFeedback(null);

    try {
      const response = await fetch(`/api/feriados/${feriado.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo: !feriado.ativo }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel alterar status.');
      }

      setFeedback({ type: 'success', message: data.message });
      await loadFeriados();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2>Feriados</h2>
          <p>Cadastro e visualizacao dos feriados do sistema</p>
        </div>
        <button className={styles.btnPrimary} type="button" onClick={openNewFeriado}>
          <Plus size={13} /> Novo Feriado
        </button>
      </div>

      <div className={styles.filters}>
        <label className={styles.periodField}>
          <span>Periodo</span>
          <MonthPicker value={filters.periodo} onChange={(value) => updateFilter('periodo', value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
      </div>

      {feedback && (
        <p className={feedback.type === 'success' ? styles.success : styles.error}>{feedback.message}</p>
      )}

      <div className={styles.indicators}>
        {indicators.map(([label, value]) => (
          <div key={label} className={styles.indicatorCard}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia da semana</th>
                <th>Descricao</th>
                <th>Tipo</th>
                <th>Cidade/UF</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.emptyCell} colSpan={7}>
                    <CalendarDays size={22} opacity={0.35} />
                    Carregando feriados...
                  </td>
                </tr>
              )}
              {!loading && filteredFeriados.length === 0 && (
                <tr>
                  <td className={styles.emptyCell} colSpan={7}>
                    <CalendarDays size={22} opacity={0.35} />
                    Nenhum feriado encontrado
                  </td>
                </tr>
              )}
              {!loading && filteredFeriados.map((feriado) => (
                <tr key={feriado.id}>
                  <td className={styles.dateCell}>{formatDateBr(feriado.data)}</td>
                  <td>{feriado.diaSemana}</td>
                  <td className={styles.nameCell}>{feriado.descricao}</td>
                  <td><span className={`${styles.typeBadge} ${styles.typeGeral}`}>Geral</span></td>
                  <td>Todos</td>
                  <td>
                    <span className={feriado.ativo ? styles.statusActive : styles.statusInactive}>
                      {feriado.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => editFeriado(feriado)}><Edit2 size={13} /> Editar</button>
                      <button type="button" onClick={() => toggleStatus(feriado)}>
                        <Power size={13} /> {feriado.ativo ? 'Inativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} role="presentation">
          <form className={styles.modalCard} onSubmit={saveFeriado}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{editingId ? 'Editar Feriado' : 'Novo Feriado'}</h3>
                <p>Feriado ativo vale para todos os funcionarios.</p>
              </div>
              <button className={styles.closeBtn} type="button" onClick={resetForm}>x</button>
            </div>

            <div className={styles.formGrid}>
              <label>
                <span>Data</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  value={form.data}
                  onChange={(event) => updateField('data', event.target.value)}
                />
              </label>
              <label className={styles.descriptionField}>
                <span>Descricao</span>
                <input type="text" value={form.descricao} onChange={(event) => updateField('descricao', event.target.value)} />
              </label>
              <label className={styles.checkField}>
                <input type="checkbox" checked={form.ativo} onChange={(event) => updateField('ativo', event.target.checked)} />
                <span>Status ativo</span>
              </label>
            </div>

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} type="button" onClick={resetForm}>Cancelar</button>
              <button className={styles.btnPrimary} type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Salvar Feriado'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
