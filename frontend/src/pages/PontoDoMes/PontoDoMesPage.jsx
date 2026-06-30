import { apiFetch } from '../../utils/api';
import { CalendarDays, ChevronDown, Download, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MonthPicker from '../../components/MonthPicker/MonthPicker';
import styles from './PontoDoMesPage.module.css';

const STATUS_CLASS = {
  Completo: 'statusNormal',
  Falta: 'statusFalta',
  Folga: 'statusFolga',
  'Em andamento': 'statusAndamento',
  Incompleto: 'statusIncompleto',
  Indevido: 'statusAtraso',
  'Fora da escala': 'statusAtraso',
  Feriado: 'statusFeriado',
  'Feriado Trabalhado': 'statusNormal',
  'Feriado pago': 'statusFeriado',
  'Falta justificada': 'statusJustified',
  'Falta descontada': 'statusJustified',
  'Pago em folha': 'statusJustified',
  Atestado: 'statusFeriado',
  'A trabalhar': 'statusScheduled',
};

function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function fieldWidth(items, selector, { min = 150, max = 340 } = {}) {
  const longest = items.reduce((size, item) => Math.max(size, String(selector(item) || '').length), 0);
  return Math.min(max, Math.max(min, (longest * 7) + 44));
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

export default function PontoDoMesPage({ employeeMode = false, user = null }) {
  const today = new Date();
  const [periodo, setPeriodo] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [matricula, setMatricula] = useState('');
  const [status, setStatus] = useState('');
  const [funcionarios, setFuncionarios] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [ano, mes] = periodo.split('-');

  const loadFuncionarios = useCallback(async () => {
    if (employeeMode) {
      setFuncionarios(user ? [{ matricula: user.matricula, nome: user.name || 'Funcionario', ativo: true }] : []);
      if (user?.matricula) {
        setMatricula(user.matricula);
      }
      return;
    }

    try {
      const response = await apiFetch('/api/funcionarios', {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel carregar funcionarios.');
      }

      const activeFuncionarios = (payload.funcionarios || []).filter((funcionario) => funcionario.ativo);
      setFuncionarios(activeFuncionarios);
      if (!matricula && activeFuncionarios[0]?.matricula) {
        setMatricula(activeFuncionarios[0].matricula);
      }
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar funcionarios.');
    }
  }, [employeeMode, matricula, user]);

  const loadPontoMes = useCallback(async () => {
    const params = new URLSearchParams({ mes, ano });

    if (matricula) {
      params.set('matricula', matricula);
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = employeeMode ? '/api/ponto/escala-mes' : '/api/ponto/admin/ponto-do-mes';
      const response = await apiFetch(`${endpoint}?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel carregar o ponto do mes.');
      }

      setData(payload);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar o ponto do mes.');
    } finally {
      setLoading(false);
    }
  }, [ano, employeeMode, mes, matricula]);

  useEffect(() => {
    loadFuncionarios();
  }, [loadFuncionarios]);

  useEffect(() => {
    if (matricula) {
      loadPontoMes();
    }
  }, [loadPontoMes, matricula]);

  const rows = useMemo(() => {
    const dias = data?.dias || [];
    if (!status) return dias;
    return dias.filter((dia) => dia.status === status);
  }, [data, status]);
  const selectedListFuncionario = useMemo(() => (
    funcionarios.find((funcionario) => String(funcionario.matricula) === String(matricula)) || null
  ), [funcionarios, matricula]);
  const filteredFuncionarios = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();

    if (!term) return funcionarios;

    return funcionarios.filter((funcionario) => (
      String(funcionario.nome || '').toLowerCase().includes(term)
      || String(funcionario.matricula || '').toLowerCase().includes(term)
    ));
  }, [employeeSearch, funcionarios]);
  const resumo = data?.resumo || {};
  const selectedFuncionario = data?.funcionario;
  const activeEscala = selectedFuncionario?.escala || data?.escala || 'Sem escala';
  const selectedLoja = selectedFuncionario?.loja || selectedListFuncionario?.lojaNome || 'Sem loja';
  const funcionarioWidth = fieldWidth(funcionarios, (funcionario) => funcionario.nome, { min: 190, max: 420 });
  const lojaWidth = fieldWidth([{ loja: selectedLoja }], (item) => item.loja, { min: 132, max: 260 });
  const indicators = [
    ['Dias no mes', resumo.dias || 0],
    ['Dias trabalhados', resumo.diasTrabalhados || 0],
    ['Faltas', resumo.faltas || 0],
    ['Folgas', resumo.folgas || 0],
    ['Pendencias', resumo.pendencias || 0],
    ['Trabalhado', resumo.trabalhado || '00:00'],
    ['Saldo do mes', resumo.saldo || '00:00'],
  ];

  function selectFuncionario(nextMatricula) {
    setMatricula(nextMatricula);
    setEmployeePickerOpen(false);
    setEmployeeSearch('');
  }

  function exportExcel() {
    const headers = [
      'Data',
      'Dia',
      'Escala',
      'Entrada',
      'Saida',
      'Entrada',
      'Saida',
      'Esperado',
      'Trabalhado',
      'Saldo',
      'Status',
    ];
    const lines = [
      headers.map(csvValue).join(';'),
      ...rows.map((row) => [
        formatDate(row.data),
        row.diaSemana || '',
        row.escala || activeEscala,
        row.entrada1 || '',
        row.saida1 || '',
        row.entrada2 || '',
        row.saida2 || '',
        row.esperado || '',
        row.trabalhado || '',
        row.saldo || '',
        row.status || '',
      ].map(csvTextValue).join(';')),
    ];
    const nome = String(selectedFuncionario?.nome || selectedListFuncionario?.nome || 'funcionario')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .toLowerCase();

    downloadCsv(`escala-mes-${nome || 'funcionario'}-${periodo}.csv`, lines);
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageTitleBlock}>
        <h2>Escala Mes</h2>
        <p>
          {selectedFuncionario?.nome || 'Funcionario'} - {activeEscala}
        </p>
      </div>

      <div className={styles.filters}>
        {!employeeMode && (
          <div
            className={styles.employeeField}
            style={{ '--field-width': `${funcionarioWidth}px` }}
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
              <strong>{selectedListFuncionario?.nome || (funcionarios.length === 0 ? 'Nenhum funcionario' : 'Selecione')}</strong>
              {selectedListFuncionario?.matricula && <em>#{selectedListFuncionario.matricula}</em>}
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
                    placeholder="Buscar por nome ou matricula"
                  />
                </label>

                <div className={styles.employeeList}>
                  {filteredFuncionarios.length === 0 && (
                    <div className={styles.employeeEmpty}>Nenhum funcionario encontrado.</div>
                  )}

                  {filteredFuncionarios.map((funcionario) => {
                    const active = String(funcionario.matricula) === String(matricula);

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
        )}
        <label style={{ '--field-width': `${lojaWidth}px` }}>
          <span>Loja</span>
          <select value={selectedLoja} disabled>
            <option>{selectedLoja}</option>
          </select>
        </label>
        <label>
          <span>Periodo</span>
          <MonthPicker value={periodo} onChange={setPeriodo} />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="Completo">Completo</option>
            <option value="Falta">Falta</option>
            <option value="Falta justificada">Falta justificada</option>
            <option value="Falta descontada">Falta descontada</option>
            <option value="Pago em folha">Pago em folha</option>
            <option value="Atestado">Atestado</option>
            <option value="Folga">Folga</option>
            <option value="Feriado">Feriado</option>
            <option value="Feriado Trabalhado">Feriado Trabalhado</option>
            <option value="Feriado pago">Feriado pago</option>
            <option value="A trabalhar">A trabalhar</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Incompleto">Incompleto</option>
            <option value="Indevido">Indevido</option>
            <option value="Fora da escala">Fora da escala</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.negative}>{error}</p>}

      <div className={styles.indicators}>
        {indicators.map(([label, value]) => (
          <div key={label} className={styles.indicatorCard}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableToolbar}>
          <div>
            <CalendarDays size={14} />
            <span>{periodo}</span>
          </div>
          <div className={styles.tableActions}>
            <button type="button" onClick={exportExcel} disabled={loading || rows.length === 0}>
              <Download size={13} /> Exportar Excel
            </button>
            <button type="button" onClick={loadPontoMes}>
              {loading ? <RefreshCw size={13} /> : <SlidersHorizontal size={13} />} Atualizar
            </button>
          </div>
        </div>
        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia</th>
                <th>Escala</th>
                <th>Entrada 1</th>
                <th>Saida 1</th>
                <th>Entrada 2</th>
                <th>Saida 2</th>
                <th>Esperado</th>
                <th>Trabalhado</th>
                <th>Saldo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.dateCell} colSpan={11}>Carregando ponto do mes...</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className={styles.dateCell} colSpan={11}>Nenhum registro encontrado.</td>
                </tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.data}>
                  <td data-label="Data" className={styles.dateCell}>{formatDate(row.data)}</td>
                  <td data-label="Dia">{row.diaSemana}</td>
                  <td data-label="Escala">{row.escala || activeEscala}</td>
                  <td data-label="Entrada 1">{row.entrada1 || '-'}</td>
                  <td data-label="Saida 1">{row.saida1 || '-'}</td>
                  <td data-label="Entrada 2">{row.entrada2 || '-'}</td>
                  <td data-label="Saida 2">{row.saida2 || '-'}</td>
                  <td data-label="Esperado">{row.esperado}</td>
                  <td data-label="Trabalhado">{row.trabalhado}</td>
                  <td data-label="Saldo" className={row.saldoMinutos === null ? undefined : Number(row.saldoMinutos || 0) < 0 ? styles.negative : styles.positive}>
                    {row.saldo || '-'}
                  </td>
                  <td data-label="Status">
                    {row.status ? (
                      <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[row.status] || 'statusIncompleto']}`}>
                        {row.status}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
