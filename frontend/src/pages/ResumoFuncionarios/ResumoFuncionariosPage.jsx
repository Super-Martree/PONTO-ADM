import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Filter,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MonthPicker from '../../components/MonthPicker/MonthPicker';
import { formatDateBr } from '../../utils/date';
import styles from './ResumoFuncionariosPage.module.css';

const STATUS_CLASS = {
  Completo: 'statusOk',
  Falta: 'statusDanger',
  Folga: 'statusNeutral',
  Feriado: 'statusInfo',
  'Feriado Trabalhado': 'statusOk',
  'Feriado pago': 'statusInfo',
  'Falta justificada': 'statusAdjusted',
  'Falta descontada': 'statusAdjusted',
  'Pago em folha': 'statusAdjusted',
  Atestado: 'statusInfo',
  'A trabalhar': 'statusScheduled',
  'Em andamento': 'statusProgress',
  Incompleto: 'statusWarning',
  Indevido: 'statusWarning',
  'Fora da escala': 'statusWarning',
};

function getInitials(nome) {
  const parts = String(nome || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '--';
}

function formatMinutes(totalMinutes) {
  const value = Number(totalMinutes || 0);
  const sign = value < 0 ? '-' : '+';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;

  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function monthLabel(value) {
  const [year, month] = String(value || '').split('-');
  const labels = {
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

  return `${labels[month] || month}/${year}`;
}

function MiniBar({ value, total, tone = 'green' }) {
  const percent = total > 0 ? Math.min(100, Math.round((Number(value || 0) / total) * 100)) : 0;

  return (
    <div className={styles.miniBar}>
      <span className={styles[tone]} style={{ width: `${percent}%` }} />
    </div>
  );
}

function SaldoBadge({ value }) {
  const positive = Number(value || 0) >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <span className={positive ? styles.saldoPositive : styles.saldoNegative}>
      <Icon size={13} />
      {formatMinutes(value)}
    </span>
  );
}

function StatusChip({ status }) {
  return (
    <span className={`${styles.statusChip} ${styles[STATUS_CLASS[status] || 'statusNeutral']}`}>
      {status || '-'}
    </span>
  );
}

export default function ResumoFuncionariosPage() {
  const today = new Date();
  const [periodo, setPeriodo] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [data, setData] = useState(null);
  const [selectedMatricula, setSelectedMatricula] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [lojaFilter, setLojaFilter] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ano, mes] = periodo.split('-');

  const loadResumo = useCallback(async () => {
    const params = new URLSearchParams({ ano, mes });

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/ponto/admin/resumo-funcionarios?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel carregar o resumo.');
      }

      setData(payload);
      setExpanded(null);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    loadResumo();
  }, [loadResumo]);

  const funcionarios = data?.funcionarios || [];
  const lojas = useMemo(() => (
    [...new Set(funcionarios.map((funcionario) => funcionario.loja || 'Sem loja'))].sort()
  ), [funcionarios]);
  const selectedFuncionario = useMemo(() => (
    funcionarios.find((funcionario) => String(funcionario.matricula) === String(selectedMatricula)) || null
  ), [funcionarios, selectedMatricula]);
  const employeeOptions = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();

    if (!term) return funcionarios;

    return funcionarios.filter((funcionario) => (
      String(funcionario.nome || '').toLowerCase().includes(term)
      || String(funcionario.matricula || '').toLowerCase().includes(term)
    ));
  }, [employeeSearch, funcionarios]);
  const filtered = useMemo(() => {
    return funcionarios.filter((funcionario) => {
      const matchesFuncionario = !selectedMatricula || String(funcionario.matricula) === String(selectedMatricula);
      const matchesLoja = !lojaFilter || (funcionario.loja || 'Sem loja') === lojaFilter;

      return matchesFuncionario && matchesLoja;
    });
  }, [funcionarios, lojaFilter, selectedMatricula]);

  const filteredResumo = useMemo(() => ({
    comDebito: filtered.filter((funcionario) => Number(funcionario.resumo?.saldoMinutos || 0) < 0).length,
    pendencias: filtered.reduce((total, funcionario) => total + Number(funcionario.resumo?.pendentes || 0), 0),
    faltas: filtered.reduce((total, funcionario) => total + Number(funcionario.resumo?.faltas || 0), 0),
  }), [filtered]);

  const summaryCards = [
    { label: 'Funcionarios com debito', value: filteredResumo.comDebito, icon: Users, tone: 'red' },
    { label: 'Pendencias no periodo', value: filteredResumo.pendencias, icon: AlertTriangle, tone: 'amber' },
    { label: 'Faltas no periodo', value: filteredResumo.faltas, icon: Clock, tone: 'blue' },
  ];

  function selectFuncionario(matricula) {
    setSelectedMatricula(matricula);
    setEmployeePickerOpen(false);
    setEmployeeSearch('');
    setExpanded(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Resumo por Funcionario</h2>
          <p>Visao mensal de saldo, faltas e pendencias por colaborador.</p>
        </div>
        <div className={styles.headerActions}>
          <MonthPicker value={periodo} onChange={setPeriodo} />
          <button type="button" onClick={loadResumo} disabled={loading}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.summaryGrid}>
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className={`${styles.summaryCard} ${styles[card.tone]}`}>
              <span className={styles.summaryIcon}><Icon size={18} /></span>
              <div>
                <small>{card.label}</small>
                <strong>{card.value}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.filters}>
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
                  className={`${styles.employeeOption} ${!selectedMatricula ? styles.employeeOptionActive : ''}`}
                  type="button"
                  onClick={() => selectFuncionario('')}
                >
                  <strong>Todos</strong>
                  <span>{funcionarios.length} funcionarios</span>
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
        <label className={styles.selectBox}>
          <Filter size={14} />
          <select value={lojaFilter} onChange={(event) => setLojaFilter(event.target.value)}>
            <option value="">Todas as lojas</option>
            {lojas.map((loja) => (
              <option key={loja} value={loja}>{loja}</option>
            ))}
          </select>
        </label>
        <span>{filtered.length} de {funcionarios.length} funcionarios</span>
      </div>

      <div className={styles.list}>
        {loading && <div className={styles.emptyState}>Carregando resumo...</div>}
        {!loading && filtered.length === 0 && <div className={styles.emptyState}>Nenhum funcionario encontrado.</div>}

        {!loading && filtered.map((funcionario) => {
          const resumo = funcionario.resumo || {};
          const geral = funcionario.geral || {};
          const isOpen = expanded === funcionario.matricula;

          return (
            <article key={funcionario.matricula} className={styles.employeeCard}>
              <button
                className={styles.employeeRow}
                type="button"
                onClick={() => setExpanded(isOpen ? null : funcionario.matricula)}
              >
                <span className={styles.avatar}>{getInitials(funcionario.nome)}</span>

                <span className={styles.employeeInfo}>
                  <strong>{funcionario.nome}</strong>
                  <small>#{funcionario.matricula} - {funcionario.loja || 'Sem loja'}</small>
                </span>

                <span className={styles.metricBlock}>
                  <small>Saldo {monthLabel(periodo)}</small>
                  <SaldoBadge value={resumo.saldoMinutos || 0} />
                </span>

                <span className={styles.metricBlock}>
                  <small>Saldo geral</small>
                  <SaldoBadge value={geral.saldoMinutos || 0} />
                </span>

                <span className={styles.metricBlock}>
                  <small>Trabalhados</small>
                  <strong>{resumo.trabalhados || 0} <em>/ {resumo.uteis || 0} dias</em></strong>
                  <MiniBar value={resumo.trabalhados || 0} total={resumo.uteis || 0} />
                </span>

                <span className={styles.metricBlock}>
                  <small>Faltas</small>
                  <strong className={Number(resumo.faltas || 0) > 0 ? styles.negativeText : ''}>{resumo.faltas || 0}</strong>
                </span>

                <span className={styles.metricBlock}>
                  <small>Pendentes</small>
                  <strong className={Number(resumo.pendentes || 0) > 0 ? styles.warningText : ''}>{resumo.pendentes || 0}</strong>
                </span>

                <ChevronDown className={isOpen ? styles.chevronOpen : ''} size={16} />
              </button>

              {isOpen && (
                <div className={styles.details}>
                  <div className={styles.detailCards}>
                    <div>
                      <small>Dias trabalhados</small>
                      <strong>{resumo.trabalhados || 0}</strong>
                      <span>de {resumo.uteis || 0} uteis</span>
                      <MiniBar value={resumo.trabalhados || 0} total={resumo.uteis || 0} />
                    </div>
                    <div>
                      <small>Dias trab. geral</small>
                      <strong>{geral.trabalhados || 0}</strong>
                      <span>de {geral.uteis || 0} uteis</span>
                      <MiniBar value={geral.trabalhados || 0} total={geral.uteis || 0} />
                    </div>
                    <div>
                      <small>Saldo do mes</small>
                      <strong>{formatMinutes(resumo.saldoMinutos || 0)}</strong>
                      <span>{Number(resumo.saldoMinutos || 0) < 0 ? 'horas em debito' : 'horas positivas'}</span>
                    </div>
                    <div>
                      <small>Saldo geral</small>
                      <strong>{formatMinutes(geral.saldoMinutos || 0)}</strong>
                      <span>acumulado ate {monthLabel(periodo)}</span>
                    </div>
                    <div>
                      <small>Pendentes</small>
                      <strong>{resumo.pendentes || 0}</strong>
                      <span>dias para conferir</span>
                      <MiniBar value={resumo.pendentes || 0} total={resumo.uteis || 0} tone="amber" />
                    </div>
                    <div>
                      <small>Faltas</small>
                      <strong>{resumo.faltas || 0}</strong>
                      <span>no periodo</span>
                      <MiniBar value={resumo.faltas || 0} total={resumo.uteis || 0} tone="red" />
                    </div>
                    <div>
                      <small>Ajustados</small>
                      <strong>{resumo.ajustados || 0}</strong>
                      <span>registros ajustados</span>
                    </div>
                    <div>
                      <small>Incompletos</small>
                      <strong>{resumo.incompletos || 0}</strong>
                      <span>batidas incompletas</span>
                    </div>
                  </div>

                  <div className={styles.tableScroller}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Dia</th>
                          <th>Escala</th>
                          <th>Previsto</th>
                          <th>Trabalhado</th>
                          <th>Saldo</th>
                          <th>Status</th>
                          <th>Pendente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(funcionario.dias || []).map((dia) => {
                          const pending = ['Falta', 'Incompleto', 'Em andamento', 'Fora da escala'].includes(dia.status);

                          return (
                            <tr key={dia.data}>
                              <td>{formatDateBr(dia.data)}</td>
                              <td>{dia.diaSemana || '-'}</td>
                              <td>{dia.escala || funcionario.escala || '-'}</td>
                              <td>{dia.esperado || '00:00'}</td>
                              <td>{dia.trabalhado || '00:00'}</td>
                              <td className={Number(dia.saldoMinutos || 0) < 0 ? styles.negativeText : styles.positiveText}>
                                {dia.saldo || '-'}
                              </td>
                              <td><StatusChip status={dia.status} /></td>
                              <td>{pending ? <span className={styles.pendingBadge}>Sim</span> : <span className={styles.muted}>Nao</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className={styles.footerCount}>
        Exibindo {filtered.length} de {funcionarios.length} funcionarios - {monthLabel(periodo)}
      </div>
    </div>
  );
}
