import { apiFetch } from '../../utils/api';
import { CalendarDays, ChevronDown, Download, Filter, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDateBr, parseDateBrInput, todayBrDateInput } from '../../utils/date';
import styles from './Apuracao.module.css';

function TimeCell({ label, value }) {
  return (
    <div className={styles.timeCell}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function getStatusClass(status) {
  if (status === 'Completo') return styles.statusOk;
  if (status === 'Feriado') return styles.statusHoliday;
  if (status === 'Feriado Trabalhado') return styles.statusOk;
  if (status === 'Em andamento') return styles.statusProgress;
  return styles.statusPending;
}

function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function isClosedPendingDay(row, today = todayIso()) {
  return Boolean(row?.data)
    && row.data < today
    && ['Falta', 'Incompleto', 'Feriado Trabalhado'].includes(row.status);
}

export default function Apuracao({ initialState = {} }) {
  const [apuracao, setApuracao] = useState(null);
  const [periodo, setPeriodo] = useState('geral');
  const [customStart, setCustomStart] = useState(todayBrDateInput);
  const [customEnd, setCustomEnd] = useState(todayBrDateInput);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    loja: '',
    status: '',
    registros: '',
  });
  const [selectedMatricula, setSelectedMatricula] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!initialState || Object.keys(initialState).length === 0) return;

    if (initialState.periodo) {
      setPeriodo(initialState.periodo);
    }

    if (typeof initialState.filtersOpen === 'boolean') {
      setFiltersOpen(initialState.filtersOpen);
    }

    if (initialState.filters) {
      setFilters((current) => ({ ...current, ...initialState.filters }));
    }
  }, [initialState]);

  const loadApuracao = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
    }
    setError('');

    try {
      const params = new URLSearchParams({ periodo });
      if (periodo === 'personalizado') {
        params.set('inicio', parseDateBrInput(customStart));
        params.set('fim', parseDateBrInput(customEnd));
      }

      const response = await apiFetch(`/api/ponto/apuracao/hoje?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar a apuracao.');
      }

      setApuracao(data);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar a apuracao.');
    } finally {
      setLoading(false);
    }
  }, [customEnd, customStart, periodo]);

  useEffect(() => {
    loadApuracao();
    const interval = periodo === 'geral' ? null : setInterval(() => loadApuracao({ quiet: true }), 10000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [loadApuracao, periodo]);

  const funcionarios = apuracao?.funcionarios || [];
  const employeeOptions = useMemo(() => {
    const byMatricula = new Map();

    for (const funcionario of funcionarios) {
      const matricula = String(funcionario.matricula || '').trim();
      if (!matricula || byMatricula.has(matricula)) continue;
      byMatricula.set(matricula, {
        matricula,
        nome: funcionario.nome || `Matricula ${matricula}`,
      });
    }

    const options = [...byMatricula.values()].sort((a, b) => a.nome.localeCompare(b.nome));
    const term = employeeSearch.trim().toLowerCase();

    if (!term) return options;

    return options.filter((funcionario) => (
      funcionario.nome.toLowerCase().includes(term)
      || funcionario.matricula.toLowerCase().includes(term)
    ));
  }, [employeeSearch, funcionarios]);
  const selectedFuncionario = useMemo(() => (
    employeeOptions.find((funcionario) => String(funcionario.matricula) === String(selectedMatricula))
    || funcionarios.find((funcionario) => String(funcionario.matricula) === String(selectedMatricula))
    || null
  ), [employeeOptions, funcionarios, selectedMatricula]);
  const lojas = useMemo(() => {
    return [...new Set(funcionarios.map((item) => item.loja || 'Sem loja'))].sort();
  }, [funcionarios]);
  const filteredFuncionarios = useMemo(() => {
    const loja = filters.loja.trim().toLowerCase();
    const status = filters.status.trim().toLowerCase();
    const registros = filters.registros;

    return funcionarios.filter((item) => {
      const itemMatricula = String(item.matricula || '').toLowerCase();
      const itemLoja = String(item.loja || 'Sem loja').toLowerCase();
      const itemStatus = String(item.status || '').toLowerCase();
      const hasRegistro = Number(item.totalBatidas || 0) > 0;

      return (!selectedMatricula || itemMatricula === String(selectedMatricula).toLowerCase())
        && (!loja || itemLoja === loja)
        && (!status || itemStatus === status)
        && (registros !== 'comRegistro' || hasRegistro);
    });
  }, [filters, funcionarios, selectedMatricula]);
  const filteredResumo = useMemo(() => {
    const today = todayIso();
    const funcionariosComRegistro = new Set(
      filteredFuncionarios
        .filter((item) => Number(item.totalBatidas || 0) > 0)
        .map((item) => String(item.matricula || '').trim())
        .filter(Boolean)
    );
    const incompletos = filteredFuncionarios.filter((item) => item.status === 'Incompleto').length;
    const pendencias = filteredFuncionarios.filter((item) => isClosedPendingDay(item, today)).length;

    return {
      funcionarios: funcionariosComRegistro.size,
      incompletos,
      pendencias,
    };
  }, [filteredFuncionarios]);
  const resumo = filteredResumo;
  const indicators = [
    { label: 'Funcionarios', value: resumo.funcionarios || 0, tone: 'green', icon: '👥' },
    { label: 'Pendencias', value: resumo.pendencias || 0, tone: 'red', icon: '⚠️' },
    { label: 'Incompletos', value: resumo.incompletos || 0, tone: 'amber', icon: '⏳' },
  ];

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function selectFuncionario(matricula) {
    setSelectedMatricula(matricula);
    setEmployeePickerOpen(false);
    setEmployeeSearch('');
  }

  function clearFilters() {
    setFilters({ loja: '', status: '', registros: '' });
    setSelectedMatricula('');
    setEmployeeSearch('');
  }

  return (
    <div className={styles.page}>
      <div className={styles.apuracaoHeader}>
        <div className={styles.indicatorGrid}>
          {indicators.map((item) => (
            <div key={item.label} className={`${styles.indicatorCard} ${styles[item.tone]}`}>
              <div className={styles.indicatorIcon}>{item.icon}</div>
              <div>
                <span>{item.label}</span>
                <strong>{String(item.value).padStart(2, '0')}</strong>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.pageActions}>
          <button
            className={`${styles.btnSecondary} ${filtersOpen ? styles.btnActive : ''}`}
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Filter size={13} /> Filtrar
          </button>
          <button className={styles.btnSecondary} type="button" onClick={() => loadApuracao()}>
            Atualizar
          </button>
          <button className={styles.btnSecondary}><Download size={13} /> Exportar</button>
        </div>
      </div>

      {filtersOpen && (
        <div className={styles.filterBar}>
          <div
            className={styles.employeePicker}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setEmployeePickerOpen(false);
              }
            }}
          >
            <span>Funcionario</span>
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
                    className={`${styles.employeeOption} ${!selectedMatricula ? styles.employeeOptionActive : ''}`}
                    type="button"
                    onClick={() => selectFuncionario('')}
                  >
                    <strong>Todos</strong>
                    <span>{funcionarios.length} registros</span>
                  </button>

                  {employeeOptions.length === 0 && (
                    <div className={styles.employeeEmpty}>Nenhum funcionario encontrado.</div>
                  )}

                  {employeeOptions.map((funcionario) => {
                    const active = String(funcionario.matricula) === String(selectedMatricula);

                    return (
                      <button
                        key={funcionario.matricula}
                        className={`${styles.employeeOption} ${active ? styles.employeeOptionActive : ''}`}
                        type="button"
                        onClick={() => selectFuncionario(funcionario.matricula)}
                      >
                        <strong>{funcionario.nome}</strong>
                        <span>#{funcionario.matricula}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <label className={styles.compactFilter}>
            <span>Loja</span>
            <select value={filters.loja} onChange={(event) => updateFilter('loja', event.target.value)}>
              <option value="">Todas</option>
              {lojas.map((loja) => (
                <option key={loja} value={loja}>{loja}</option>
              ))}
            </select>
          </label>
          <label className={styles.compactFilter}>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Todos</option>
              <option value="Falta">Falta</option>
              <option value="Folga">Folga</option>
              <option value="Feriado">Feriado</option>
              <option value="Feriado Trabalhado">Feriado Trabalhado</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Incompleto">Incompleto</option>
              <option value="Completo">Completo</option>
              <option value="Indevido">Indevido</option>
              <option value="Fora da escala">Fora da escala</option>
            </select>
          </label>
          <label className={styles.compactFilter}>
            <span>Periodo</span>
            <select value={periodo} onChange={(event) => setPeriodo(event.target.value)}>
              <option value="geral">Geral</option>
              <option value="hoje">Hoje</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </label>
          {filters.registros === 'comRegistro' && (
            <label className={styles.compactFilter}>
              <span>Registros</span>
              <select value={filters.registros} onChange={(event) => updateFilter('registros', event.target.value)}>
                <option value="comRegistro">Com batida</option>
                <option value="">Todos</option>
              </select>
            </label>
          )}
          {periodo === 'personalizado' && (
            <>
              <label className={styles.compactFilter}>
                <span>Inicio</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                    />
                  </label>
                  <label className={styles.compactFilter}>
                    <span>Fim</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                    />
                  </label>
            </>
          )}
          <button className={styles.btnSecondary} type="button" onClick={clearFilters}>
            Limpar
          </button>
        </div>
      )}

      <div className={styles.card}>
        {loading && (
          <div className={styles.emptyState}>
            <CalendarDays size={28} opacity={0.3} />
            <span>Carregando apuracao...</span>
          </div>
        )}
        {!loading && error && (
          <div className={styles.emptyState}>
            <CalendarDays size={28} opacity={0.3} />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && filteredFuncionarios.length === 0 && (
          <div className={styles.emptyState}>
            <CalendarDays size={28} opacity={0.3} />
            <span>Nenhuma apuracao encontrada</span>
          </div>
        )}
        {!loading && !error && filteredFuncionarios.length > 0 && (
          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Funcionario</th>
                  <th>Matricula</th>
                  <th>Loja</th>
                  <th>Escala</th>
                  <th>Data</th>
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
                {filteredFuncionarios.map((item) => (
                  <tr key={`${item.matricula}-${item.data}`}>
                    <td className={styles.employeeCell}>{item.nome}</td>
                    <td className={styles.metricCell}>{item.matricula}</td>
                    <td className={styles.metricCell}>{item.loja || 'Sem loja'}</td>
                    <td className={styles.metricCell}>{item.escala || 'Sem escala'}</td>
                    <td className={styles.dateCell}>{formatDateBr(item.data)}</td>
                    <td><TimeCell label="E" value={item.entrada1} /></td>
                    <td><TimeCell label="S" value={item.saida1} /></td>
                    <td><TimeCell label="E" value={item.entrada2} /></td>
                    <td><TimeCell label="S" value={item.saida2} /></td>
                    <td className={styles.metricCell}>{item.esperado || '00:00'}</td>
                    <td className={styles.metricCell}>{item.trabalhado || '00:00'}</td>
                    <td className={item.saldoMinutos === null ? styles.metricCell : Number(item.saldoMinutos || 0) >= 0 ? styles.statusOk : styles.statusPending}>
                      {item.saldo || '-'}
                    </td>
                    <td className={getStatusClass(item.status)}>
                      {item.status || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
