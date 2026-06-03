import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  RotateCcw,
  Save,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDateBr, parseDateBrInput, todayBrDateInput, toBrDateInput } from '../../utils/date';
import styles from './EscalasFuncionariosPage.module.css';

const PAGE_SIZE = 10;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getInitials(nome) {
  const parts = String(nome || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '--';
}

function addDays(dateText, amount) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + amount);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function EscalaTag({ escala }) {
  if (!escala) {
    return <span className={styles.noScale}>Sem escala</span>;
  }

  return (
    <span className={styles.scaleTag}>
      <strong>{escala.nome}</strong>
    </span>
  );
}

export default function EscalasFuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [startDrafts, setStartDrafts] = useState({});
  const [initialStartDrafts, setInitialStartDrafts] = useState({});
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [lojaFilter, setLojaFilter] = useState('Todos');
  const [escalaFilter, setEscalaFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [savedIds, setSavedIds] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [historyFuncionario, setHistoryFuncionario] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [undoingHistoryId, setUndoingHistoryId] = useState(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [funcionariosResponse, escalasResponse] = await Promise.all([
        fetch('/api/funcionarios', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/escalas', { cache: 'no-store', credentials: 'include' }),
      ]);
      const funcionariosData = await funcionariosResponse.json().catch(() => ({}));
      const escalasData = await escalasResponse.json().catch(() => ({}));

      if (!funcionariosResponse.ok) {
        throw new Error(funcionariosData.message || 'Nao foi possivel carregar funcionarios.');
      }

      if (!escalasResponse.ok) {
        throw new Error(escalasData.message || 'Nao foi possivel carregar escalas.');
      }

      const nextFuncionarios = funcionariosData.funcionarios || [];
      const nextStartDrafts = Object.fromEntries(nextFuncionarios.map((funcionario) => [
        funcionario.id,
        toBrDateInput(funcionario.escalaDataInicio) || todayBrDateInput(),
      ]));

      setFuncionarios(nextFuncionarios);
      setEscalas(escalasData.escalas || []);
      setDrafts(Object.fromEntries(nextFuncionarios.map((funcionario) => [
        funcionario.id,
        funcionario.escalaId ? String(funcionario.escalaId) : '',
      ])));
      setStartDrafts(nextStartDrafts);
      setInitialStartDrafts(nextStartDrafts);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const escalasAtivas = useMemo(() => escalas.filter((escala) => escala.ativo), [escalas]);
  const escalaById = useMemo(() => new Map(escalas.map((escala) => [String(escala.id), escala])), [escalas]);
  const selectedFuncionario = useMemo(() => (
    funcionarios.find((funcionario) => String(funcionario.id) === String(selectedFuncionarioId)) || null
  ), [funcionarios, selectedFuncionarioId]);
  const employeeOptions = useMemo(() => {
    const term = normalizeText(employeeSearch);

    if (!term) return funcionarios;

    return funcionarios.filter((funcionario) => [
      funcionario.nome,
      funcionario.matricula,
    ].some((value) => normalizeText(value).includes(term)));
  }, [employeeSearch, funcionarios]);
  const lojas = useMemo(() => (
    ['Todos', ...new Set(funcionarios.map((funcionario) => funcionario.lojaNome || 'Sem loja'))]
  ), [funcionarios]);
  const escalaOptions = useMemo(() => (
    ['Todos', 'Sem escala', ...new Set(escalas.map((escala) => escala.nome))]
  ), [escalas]);
  const pendingIds = useMemo(() => (
    funcionarios
      .filter((funcionario) => (
        String(funcionario.escalaId || '') !== String(drafts[funcionario.id] || '')
        || String(initialStartDrafts[funcionario.id] || '') !== String(startDrafts[funcionario.id] || '')
      ))
      .map((funcionario) => funcionario.id)
  ), [drafts, funcionarios, initialStartDrafts, startDrafts]);
  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter((funcionario) => {
      const currentEscala = funcionario.escalaNome || 'Sem escala';
      const matchFuncionario = !selectedFuncionarioId || String(funcionario.id) === String(selectedFuncionarioId);
      const matchLoja = lojaFilter === 'Todos' || (funcionario.lojaNome || 'Sem loja') === lojaFilter;
      const matchEscala = escalaFilter === 'Todos' || currentEscala === escalaFilter;

      return matchFuncionario && matchLoja && matchEscala;
    });
  }, [escalaFilter, funcionarios, lojaFilter, selectedFuncionarioId]);
  const totalPages = Math.max(1, Math.ceil(filteredFuncionarios.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedFuncionarios = filteredFuncionarios.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = {
    total: funcionarios.length,
    comEscala: funcionarios.filter((funcionario) => funcionario.escalaId).length,
    semEscala: funcionarios.filter((funcionario) => !funcionario.escalaId).length,
    pendentes: pendingIds.length,
  };

  function updateDraft(funcionarioId, value) {
    setDrafts((current) => ({ ...current, [funcionarioId]: value }));
  }

  function updateStartDraft(funcionarioId, value) {
    setStartDrafts((current) => ({ ...current, [funcionarioId]: value }));
  }

  function selectFuncionario(funcionarioId) {
    setSelectedFuncionarioId(funcionarioId);
    setEmployeePickerOpen(false);
    setEmployeeSearch('');
    setPage(1);
  }

  function resetDrafts() {
    setDrafts(Object.fromEntries(funcionarios.map((funcionario) => [
      funcionario.id,
      funcionario.escalaId ? String(funcionario.escalaId) : '',
    ])));
    setStartDrafts(initialStartDrafts);
    setFeedback(null);
  }

  async function persistEscala(funcionario) {
    const dataInicio = parseDateBrInput(startDrafts[funcionario.id]);

    if (!dataInicio) {
      throw new Error(`Informe o inicio da escala de ${funcionario.nome} no formato dd/mm/aaaa.`);
    }

    const response = await fetch(`/api/funcionarios/${funcionario.id}/escala`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        escalaId: drafts[funcionario.id] || null,
        dataInicio,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Nao foi possivel salvar a escala do funcionario.');
    }

    return data;
  }

  async function saveEscala(funcionario) {
    setFeedback(null);
    setSavingId(funcionario.id);

    try {
      const data = await persistEscala(funcionario);
      setSavedIds((current) => ({ ...current, [funcionario.id]: true }));
      setFeedback({ type: 'success', message: data.message });
      await loadData();
      setTimeout(() => {
        setSavedIds((current) => {
          const next = { ...current };
          delete next[funcionario.id];
          return next;
        });
      }, 1800);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSavingId(null);
    }
  }

  async function saveAll() {
    const changed = funcionarios.filter((funcionario) => pendingIds.includes(funcionario.id));
    if (!changed.length) return;

    setSavingAll(true);
    setFeedback(null);

    try {
      for (const funcionario of changed) {
        await persistEscala(funcionario);
      }
      setFeedback({ type: 'success', message: `${changed.length} alteracao(oes) salva(s) com sucesso.` });
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSavingAll(false);
    }
  }

  async function openHistory(funcionario) {
    setHistoryFuncionario(funcionario);
    setHistoryRows([]);
    setHistoryLoading(true);
    setUndoingHistoryId(null);
    setSelectedHistoryId(null);

    try {
      const response = await fetch(`/api/funcionarios/${funcionario.id}/escalas-historico`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar o historico.');
      }

      const historico = data.historico || [];
      setHistoryRows(historico.map((row, index) => ({
        ...row,
        dataFim: index === 0 ? '' : addDays(historico[index - 1]?.dataInicio, -1),
      })));
    } catch (error) {
      setHistoryRows([{ id: 'error', escalaNome: error.message, dataInicio: '-' }]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function deleteHistoryScale(row) {
    if (!historyFuncionario || row.id === 'error') return;
    setUndoingHistoryId(row.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/funcionarios/${historyFuncionario.id}/escalas-historico/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel excluir o registro de escala.');
      }

      setFeedback({ type: 'success', message: data.message || 'Registro de escala excluido com sucesso.' });
      await loadData();
      await openHistory(historyFuncionario);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setUndoingHistoryId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h2>Escala por Funcionario</h2>
          <p>Vincule escalas e datas de vigencia aos funcionarios.</p>
        </div>
        <div className={styles.topActions}>
          {pendingIds.length > 0 && (
            <span className={styles.pendingCounter}>{pendingIds.length} alteracao(oes) pendente(s)</span>
          )}
          <button className={styles.btnSecondary} type="button" onClick={resetDrafts} disabled={pendingIds.length === 0 || savingAll}>
            <RotateCcw size={13} /> Reverter
          </button>
          <button className={styles.btnPrimary} type="button" onClick={saveAll} disabled={pendingIds.length === 0 || savingAll}>
            <Save size={13} /> {savingAll ? 'Salvando...' : 'Salvar Todos'}
          </button>
        </div>
      </div>

      {feedback && (
        <p className={feedback.type === 'success' ? styles.success : styles.error}>{feedback.message}</p>
      )}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}><Users size={18} /></span>
          <div><small>Total</small><strong>{String(stats.total).padStart(2, '0')}</strong></div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}><CheckCircle2 size={18} /></span>
          <div><small>Com escala</small><strong>{String(stats.comEscala).padStart(2, '0')}</strong></div>
        </div>
        <div className={`${styles.summaryCard} ${styles.danger}`}>
          <span className={styles.summaryIcon}><AlertTriangle size={18} /></span>
          <div><small>Sem escala</small><strong>{String(stats.semEscala).padStart(2, '0')}</strong></div>
        </div>
        <div className={`${styles.summaryCard} ${styles.warning}`}>
          <span className={styles.summaryIcon}><Clock size={18} /></span>
          <div><small>Pendentes</small><strong>{String(stats.pendentes).padStart(2, '0')}</strong></div>
        </div>
      </div>

      <div className={styles.filterCard}>
        <div
          className={styles.employeePicker}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setEmployeePickerOpen(false);
            }
          }}
        >
          <button
            className={styles.employeeSelect}
            type="button"
            onClick={() => setEmployeePickerOpen((value) => !value)}
          >
            <Users size={14} />
            <strong>{selectedFuncionario?.nome || 'Todos'}</strong>
            {selectedFuncionario?.matricula && <em>#{selectedFuncionario.matricula}</em>}
            <ChevronDown size={14} className={employeePickerOpen ? styles.chevronOpen : ''} />
          </button>

          {employeePickerOpen && (
            <div className={styles.employeeMenu}>
              <label className={styles.employeeSearch}>
                <Search size={14} />
                <input
                  autoFocus
                  type="search"
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Pesquisar por nome ou matricula"
                />
              </label>
              <div className={styles.employeeOptions}>
                <button
                  className={`${styles.employeeOption} ${!selectedFuncionarioId ? styles.employeeOptionActive : ''}`}
                  type="button"
                  onClick={() => selectFuncionario('')}
                >
                  <strong>Todos</strong>
                  <span>{funcionarios.length} funcionarios</span>
                </button>
                {employeeOptions.length === 0 && <div className={styles.employeeEmpty}>Nenhum funcionario encontrado.</div>}
                {employeeOptions.map((funcionario) => (
                  <button
                    key={funcionario.id}
                    className={`${styles.employeeOption} ${String(funcionario.id) === String(selectedFuncionarioId) ? styles.employeeOptionActive : ''}`}
                    type="button"
                    onClick={() => selectFuncionario(String(funcionario.id))}
                  >
                    <strong>{funcionario.nome}</strong>
                    <span>#{funcionario.matricula}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.storeFilters}>
            {lojas.map((loja) => (
            <button
              key={loja}
              className={lojaFilter === loja ? styles.pillActive : styles.pill}
              type="button"
              onClick={() => {
                setLojaFilter(loja);
                setPage(1);
              }}
            >
              {loja}
            </button>
          ))}
        </div>

        <select
          className={styles.filterSelect}
          value={escalaFilter}
          onChange={(event) => {
            setEscalaFilter(event.target.value);
            setPage(1);
          }}
        >
          {escalaOptions.map((option) => <option key={option} value={option}>{option === 'Todos' ? 'Todas as escalas' : option}</option>)}
        </select>
      </div>

      <div className={styles.card}>
        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Matricula</th>
                <th>Funcionario</th>
                <th>Loja</th>
                <th>Escala atual</th>
                <th>Vigente desde</th>
                <th>Definir escala</th>
                <th>Inicio</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    <Users size={24} opacity={0.3} />
                    Carregando funcionarios...
                  </td>
                </tr>
              )}

              {!loading && filteredFuncionarios.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    <Search size={24} opacity={0.3} />
                    Nenhum funcionario encontrado.
                  </td>
                </tr>
              )}

              {!loading && paginatedFuncionarios.map((funcionario) => {
                const escalaAtual = funcionario.escalaId ? escalaById.get(String(funcionario.escalaId)) : null;
                const changed = pendingIds.includes(funcionario.id);
                const saved = savedIds[funcionario.id];

                return (
                  <tr key={funcionario.id} className={saved ? styles.savedRow : changed ? styles.pendingRow : undefined}>
                    <td className={styles.matriculaCell}>#{funcionario.matricula}</td>
                    <td>
                      <div className={styles.employeeCell}>
                        <span>{getInitials(funcionario.nome)}</span>
                        <strong>{funcionario.nome}</strong>
                      </div>
                    </td>
                    <td><span className={styles.storeTag}>{funcionario.lojaNome || 'Sem loja'}</span></td>
                    <td><EscalaTag escala={escalaAtual} /></td>
                    <td className={styles.dateCell}>{funcionario.escalaDataInicio ? formatDateBr(funcionario.escalaDataInicio) : '-'}</td>
                    <td>
                      <select
                        className={`${styles.scaleSelect} ${changed ? styles.changedInput : ''}`}
                        value={drafts[funcionario.id] || ''}
                        onChange={(event) => updateDraft(funcionario.id, event.target.value)}
                      >
                        <option value="">Sem escala</option>
                        {escalasAtivas.map((escala) => (
                          <option key={escala.id} value={escala.id}>{escala.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className={`${styles.dateInput} ${changed ? styles.changedInput : ''}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/aaaa"
                        value={startDrafts[funcionario.id] || ''}
                        onChange={(event) => updateStartDraft(funcionario.id, event.target.value)}
                      />
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {saved ? (
                          <span className={styles.savedBadge}>Salvo</span>
                        ) : (
                          <button
                            className={styles.saveButton}
                            type="button"
                            disabled={!changed || savingId === funcionario.id || savingAll}
                            onClick={() => saveEscala(funcionario)}
                          >
                            <Save size={13} /> {savingId === funcionario.id ? 'Salvando...' : 'Salvar'}
                          </button>
                        )}
                        <button className={styles.historyButton} type="button" onClick={() => openHistory(funcionario)} title="Ver historico">
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.footerCount}>
          <span>
            {filteredFuncionarios.length} de {funcionarios.length} funcionarios
          </span>
          <div className={styles.pagination}>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={13} /> Anterior
            </button>
            <strong>{currentPage} / {totalPages}</strong>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage >= totalPages}
            >
              Proximo <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {historyFuncionario && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setHistoryFuncionario(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Historico de Escalas</h3>
                <p>{historyFuncionario.nome} - #{historyFuncionario.matricula}</p>
              </div>
              <button type="button" onClick={() => setHistoryFuncionario(null)} aria-label="Fechar">
                <X size={15} />
              </button>
            </div>
            {historyLoading && <div className={styles.historyEmpty}>Carregando historico...</div>}
            {!historyLoading && historyRows.length === 0 && <div className={styles.historyEmpty}>Nenhuma alteracao de escala registrada.</div>}
            {!historyLoading && historyRows.length > 0 && (
              <div className={styles.historyList}>
                <div className={styles.historyHead}>
                  <span>Escala</span>
                  <span>Inicio</span>
                  <span>Fim</span>
                  <span>Alterado em</span>
                  <span>Ação</span>
                </div>
                {historyRows.map((row) => {
                  const selected = String(selectedHistoryId) === String(row.id);
                  const canDelete = row.id !== 'error';
                  const vigente = !row.dataFim;

                  return (
                  <div
                    key={row.id}
                    className={`${styles.historyItem} ${selected ? styles.historyItemSelected : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedHistoryId(selected ? null : row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedHistoryId(selected ? null : row.id);
                      }
                    }}
                  >
                    <strong>{row.escalaNome || 'Sem escala'}</strong>
                    <span>{formatDateBr(row.dataInicio)}</span>
                    <span>{vigente ? 'Vigente' : formatDateBr(row.dataFim)}</span>
                    <em>{row.atualizadoEm ? formatDateBr(String(row.atualizadoEm).slice(0, 10)) : '-'}</em>
                    {canDelete && selected ? (
                      <button
                        className={styles.historyDeleteButton}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteHistoryScale(row);
                        }}
                        disabled={undoingHistoryId === row.id}
                        title="Excluir registro"
                      >
                        <X size={13} />
                      </button>
                    ) : (
                      <span className={styles.historyMuted}>-</span>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
