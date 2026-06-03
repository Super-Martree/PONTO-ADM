import { apiFetch } from '../../utils/api';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MonthPicker from '../../components/MonthPicker/MonthPicker';
import { formatDateBr } from '../../utils/date';
import styles from './TratativasAjustarPontoPage.module.css';

const TIPOS_AJUSTE = [
  { value: 'ALTERAR_BATIDA', label: 'Batida' },
  { value: 'JUSTIFICAR_FALTA', label: 'Falta justificada' },
  { value: 'ABONAR_DIA', label: 'Atestado' },
  { value: 'FALTA_DESCONTADA', label: 'Falta descontada' },
  { value: 'PAGO_EM_FOLHA', label: 'Pago em folha' },
  { value: 'MARCAR_FERIADO', label: 'Feriado pago' },
  { value: 'MARCAR_FOLGA', label: 'Marcar folga' },
  { value: 'MARCAR_TRABALHO', label: 'Marcar trabalho' },
];

const STATUS_LABEL = {
  FALTA: 'Falta',
  FOLGA: 'Folga',
  FERIADO: 'Feriado',
  A_TRABALHAR: 'A trabalhar',
  TRABALHO_EM_FOLGA: 'Trab. em folga',
  TRABALHO_EM_FERIADO: 'Trab. em feriado',
  EM_ANDAMENTO: 'Em andamento',
  INCOMPLETO: 'Incompleto',
  TRABALHADO: 'Trabalhado',
  FALTA_JUSTIFICADA: 'Falta justificada',
  ATESTADO: 'Atestado',
  FALTA_DESCONTADA: 'Falta descontada',
  PAGO_EM_FOLHA: 'Pago em folha',
  FERIADO_PAGO: 'Feriado pago',
};

const STATUS_CLASS = {
  FALTA: 'statusFalta',
  INCOMPLETO: 'statusPendente',
  TRABALHO_EM_FOLGA: 'statusPendente',
  TRABALHO_EM_FERIADO: 'statusTrabalhado',
  EM_ANDAMENTO: 'statusPendente',
  TRABALHADO: 'statusTrabalhado',
  FOLGA: 'statusFolga',
  FERIADO: 'statusFeriado',
  A_TRABALHAR: 'statusScheduled',
  FALTA_JUSTIFICADA: 'statusAjustado',
  ATESTADO: 'statusFeriado',
  FALTA_DESCONTADA: 'statusAjustado',
  PAGO_EM_FOLHA: 'statusAjustado',
  FERIADO_PAGO: 'statusFeriado',
};

const BLOCKING_ADJUSTMENTS = new Set(['FALTA_DESCONTADA', 'PAGO_EM_FOLHA', 'MARCAR_FERIADO']);

const BLOCKING_ADJUSTMENT_MESSAGE = 'Este dia tem Falta descontada, Pago em folha ou Feriado pago ativo. Desfaca esse ajuste antes de lancar outro.';

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function emptyForm(row = null) {
  return {
    entrada1: row?.entrada1 || '',
    saida1: row?.saida1 || '',
    entrada2: row?.entrada2 || '',
    saida2: row?.saida2 || '',
    tipoAjuste: row?.tipoAjuste || 'ALTERAR_BATIDA',
    metaPrevista: minutesToTime(row?.metaMinutosOverride || row?.esperadoMinutos || 480),
    motivo: row?.motivo || '',
    observacao: row?.observacao || '',
  };
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length === 5 ? text : text.slice(0, 5);
}

function minutesToTime(minutes) {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return (hours * 60) + minutes;
}

function normalizeDuration(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function formatAuditDateTime(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return text || '-';
  return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
}

function adjustmentLabel(value) {
  return TIPOS_AJUSTE.find((item) => item.value === value)?.label || value || '-';
}

function adjustmentPunchesLabel(ajuste = {}) {
  const punches = [
    ['E1', ajuste.entrada1],
    ['S1', ajuste.saida1],
    ['E2', ajuste.entrada2],
    ['S2', ajuste.saida2],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label} ${value}`);

  return punches.length ? punches.join(' | ') : '-';
}

function originalPunchesLabel(ajuste = {}) {
  const punches = [
    ['E1', ajuste.originalEntrada1],
    ['S1', ajuste.originalSaida1],
    ['E2', ajuste.originalEntrada2],
    ['S2', ajuste.originalSaida2],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label} ${value}`);

  return punches.length ? punches.join(' | ') : '-';
}

function isPunchAdjustment(ajuste = {}) {
  return ajuste.tipoAjuste === 'ALTERAR_BATIDA';
}

function auditButtonLabel(row) {
  if (row.ajustado && row.ajusteNumero) return `Ajuste ${row.ajusteNumero}`;
  if (row.ajusteTotal) return `Historico ${row.ajusteTotal}`;
  return 'Ajustado';
}

function validateForm(form) {
  if (!form.motivo.trim()) return 'Informe o motivo do ajuste.';

  if (form.tipoAjuste === 'ALTERAR_BATIDA') {
    const ordered = [form.entrada1, form.saida1, form.entrada2, form.saida2]
      .filter(Boolean)
      .map(timeToMinutes);

    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index] <= ordered[index - 1]) {
        return 'A ordem deve ser entrada1 < saida1 < entrada2 < saida2.';
      }
    }
  }

  if (form.tipoAjuste === 'MARCAR_TRABALHO') {
    const meta = timeToMinutes(form.metaPrevista);
    if (!meta || meta <= 0) {
      return 'Informe as horas previstas para marcar trabalho.';
    }
  }

  return '';
}

function fieldWidth(items, selector, { min = 150, max = 340 } = {}) {
  const longest = items.reduce((size, item) => Math.max(size, String(selector(item) || '').length), 0);
  return Math.min(max, Math.max(min, (longest * 7) + 44));
}

function parseBalanceMinutes(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(-)?(\d{1,3}):(\d{2})$/);
  if (!match) return 0;
  const minutes = (Number(match[2]) * 60) + Number(match[3]);
  return match[1] ? -minutes : minutes;
}

function pct(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value || 0) / Number(total || 0)) * 100)));
}

function IndicadorCard({ badge, badgeTone, icon: Icon, label, value, valueTone, sub, barPct, barTone }) {
  return (
    <div className={styles.indicatorCard}>
      <span className={`${styles.indicatorBadge} ${styles[badgeTone]}`}>{badge}</span>
      <Icon className={styles.indicatorIcon} size={20} />
      <div className={styles.indicatorLabel}>{label}</div>
      <div className={`${styles.indicatorValue} ${styles[valueTone] || ''}`}>{value}</div>
      <div className={styles.indicatorSub}>{sub}</div>
      <div className={styles.indicatorProgress}>
        <div className={styles.indicatorTrack}>
          <div className={`${styles.indicatorFill} ${styles[barTone]}`} style={{ width: `${barPct}%` }} />
        </div>
        <span>{barPct}%</span>
      </div>
    </div>
  );
}

function IndicadoresAjustePonto({ grade, resumo }) {
  const dias = grade?.dias || [];
  const totalUteis = dias.filter((row) => !['FOLGA', 'FERIADO', 'FERIADO_PAGO'].includes(row.status)).length || Number(resumo.dias || 0);
  const diasTrabalhados = dias.filter((row) => ['TRABALHADO', 'TRABALHO_EM_FOLGA', 'TRABALHO_EM_FERIADO'].includes(row.status)).length;
  const pendentes = Number(resumo.pendentes || 0);
  const faltas = Number(resumo.faltas || 0);
  const ajustados = Number(resumo.ajustados || 0);
  const incompletos = Number(resumo.incompletos || 0);
  const saldo = resumo.saldo || '00:00';
  const saldoMinutos = Number.isFinite(Number(resumo.saldoMinutos)) ? Number(resumo.saldoMinutos) : parseBalanceMinutes(saldo);
  const saldoPct = Math.min(100, Math.round((Math.abs(saldoMinutos) / 480) * 100));
  const saldoNegativo = saldoMinutos < 0;

  const cards = [
    {
      badge: '+ mes',
      badgeTone: 'badgeGreen',
      icon: Calendar,
      label: 'Dias trabalhados',
      value: diasTrabalhados,
      valueTone: 'valueDark',
      sub: `de ${totalUteis} dias uteis`,
      barPct: pct(diasTrabalhados, totalUteis),
      barTone: 'fillGreen',
    },
    {
      badge: saldoNegativo ? 'acao' : 'ok',
      badgeTone: saldoNegativo ? 'badgeOrange' : 'badgeGreen',
      icon: Clock,
      label: 'Saldo do mes',
      value: saldo,
      valueTone: saldoNegativo ? 'valueOrange' : 'valueGreen',
      sub: saldoNegativo ? 'horas em debito' : 'horas positivas',
      barPct: saldoPct,
      barTone: saldoNegativo ? 'fillOrange' : 'fillGreen',
    },
    {
      badge: pendentes ? 'acao' : 'ok',
      badgeTone: pendentes ? 'badgeOrange' : 'badgeSoftGreen',
      icon: AlertTriangle,
      label: 'Pendentes',
      value: pendentes,
      valueTone: pendentes ? 'valueOrange' : 'valueGreen',
      sub: 'dias para conferir',
      barPct: pct(pendentes, totalUteis),
      barTone: 'fillOrange',
    },
    {
      badge: '+ mes',
      badgeTone: 'badgeGreen',
      icon: XCircle,
      label: 'Faltas',
      value: faltas,
      valueTone: faltas ? 'valueOrange' : 'valueDark',
      sub: 'no periodo',
      barPct: pct(faltas, totalUteis),
      barTone: faltas ? 'fillOrange' : 'fillOlive',
    },
    {
      badge: 'ok',
      badgeTone: 'badgeSoftGreen',
      icon: CheckCircle,
      label: 'Ajustados',
      value: ajustados,
      valueTone: 'valueGreen',
      sub: 'registros ajustados',
      barPct: pct(ajustados, totalUteis),
      barTone: 'fillGreen',
    },
    {
      badge: 'ao vivo',
      badgeTone: 'badgeBlue',
      icon: FileText,
      label: 'Incompletos',
      value: incompletos,
      valueTone: incompletos ? 'valueBlue' : 'valueDark',
      sub: 'batidas incompletas',
      barPct: pct(incompletos, totalUteis),
      barTone: 'fillBlue',
    },
  ];

  return (
    <div className={styles.indicatorsGrid}>
      {cards.map((card) => (
        <IndicadorCard key={card.label} {...card} />
      ))}
    </div>
  );
}

export default function TratativasAjustarPontoPage() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [mes, setMes] = useState(currentMonth);
  const [status, setStatus] = useState('');
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [grade, setGrade] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [auditRow, setAuditRow] = useState(null);
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [undoingId, setUndoingId] = useState(null);

  const loadFuncionarios = useCallback(async () => {
    try {
      const response = await apiFetch('/api/funcionarios', {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel carregar funcionarios.');
      }

      const active = (payload.funcionarios || []).filter((item) => item.ativo);
      setFuncionarios(active);
      if (!funcionarioId && active[0]?.id) {
        setFuncionarioId(String(active[0].id));
      }
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar funcionarios.');
    }
  }, [funcionarioId]);

  const loadGrade = useCallback(async () => {
    if (!funcionarioId) return;
    setLoading(true);
    setError('');
    setFeedback('');

    try {
      const params = new URLSearchParams({ funcionarioId, mes });
      const response = await apiFetch(`/api/admin/ajustar-ponto?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel carregar ajuste de ponto.');
      }
      setGrade(payload);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar ajuste de ponto.');
    } finally {
      setLoading(false);
    }
  }, [funcionarioId, mes]);

  useEffect(() => {
    loadFuncionarios();
  }, [loadFuncionarios]);

  useEffect(() => {
    loadGrade();
  }, [loadGrade]);

  const selectedFuncionario = useMemo(() => (
    funcionarios.find((funcionario) => String(funcionario.id) === String(funcionarioId)) || null
  ), [funcionarios, funcionarioId]);

  const rows = useMemo(() => {
    return (grade?.dias || []).filter((row) => (
      (!status || row.status === status)
      && (!somentePendentes || row.pendente)
    ));
  }, [grade, somentePendentes, status]);

  const resumo = grade?.resumo || {};
  const statusOptions = useMemo(() => {
    return [...new Set((grade?.dias || []).map((row) => row.status).filter(Boolean))].sort();
  }, [grade]);
  const lojaWidth = fieldWidth([selectedFuncionario].filter(Boolean), (funcionario) => funcionario.lojaNome || 'Sem loja', { min: 132, max: 260 });
  const funcionarioWidth = fieldWidth(funcionarios, (funcionario) => funcionario.nome, { min: 190, max: 420 });

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateTipoAjuste(value) {
    if (editingRow?.status === 'TRABALHADO') {
      setForm((current) => ({ ...current, tipoAjuste: 'ALTERAR_BATIDA' }));
      return;
    }

    setForm((current) => ({
      ...current,
      tipoAjuste: value,
      metaPrevista: value === 'MARCAR_TRABALHO' && (!current.metaPrevista || current.metaPrevista === '00:00')
        ? '08:00'
        : current.metaPrevista,
    }));
  }

  function openEditor(row) {
    if (row.ajustado && BLOCKING_ADJUSTMENTS.has(row.tipoAjuste)) {
      setError(BLOCKING_ADJUSTMENT_MESSAGE);
      setFeedback('');
      return;
    }
    setEditingRow(row);
    setForm({
      ...emptyForm(row),
      tipoAjuste: row.status === 'TRABALHADO' ? 'ALTERAR_BATIDA' : (row.tipoAjuste || 'ALTERAR_BATIDA'),
    });
    setFeedback('');
    setError('');
  }

  function closeEditor() {
    setEditingRow(null);
    setForm(emptyForm());
    setSaving(false);
  }

  function openAudit(row) {
    setAuditRow(row);
    const activeAdjustment = (row.ajustesHistorico || []).find((ajuste) => ajuste.ativo);
    setSelectedAdjustmentId(activeAdjustment?.id || null);
    setFeedback('');
    setError('');
  }

  function closeAudit() {
    setAuditRow(null);
    setSelectedAdjustmentId(null);
    setUndoingId(null);
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    if (!editingRow || !funcionarioId) return;

    const validation = validateForm(form);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await apiFetch(`/api/admin/ajustar-ponto/${funcionarioId}/${editingRow.data}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entrada1: form.tipoAjuste === 'ALTERAR_BATIDA' ? normalizeTime(form.entrada1) : '',
          saida1: form.tipoAjuste === 'ALTERAR_BATIDA' ? normalizeTime(form.saida1) : '',
          entrada2: form.tipoAjuste === 'ALTERAR_BATIDA' ? normalizeTime(form.entrada2) : '',
          saida2: form.tipoAjuste === 'ALTERAR_BATIDA' ? normalizeTime(form.saida2) : '',
          tipoAjuste: form.tipoAjuste,
          metaMinutosOverride: form.tipoAjuste === 'MARCAR_TRABALHO' ? timeToMinutes(form.metaPrevista) : null,
          motivo: form.motivo,
          observacao: form.observacao,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel salvar ajuste.');
      }

      setFeedback(payload.message || 'Ajuste salvo com sucesso.');
      await loadGrade();
      closeEditor();
    } catch (err) {
      setError(err.message || 'Nao foi possivel salvar ajuste.');
    } finally {
      setSaving(false);
    }
  }

  async function undoAdjustment(ajuste) {
    if (!auditRow || !funcionarioId) return;

    setUndoingId(ajuste?.id || 'current');
    setError('');
    setFeedback('');

    try {
      const ajustePath = ajuste?.id ? `/${ajuste.id}` : '';
      const response = await apiFetch(`/api/admin/ajustar-ponto/${funcionarioId}/${auditRow.data}${ajustePath}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel desfazer ajuste.');
      }

      setFeedback(payload.message || 'Ajuste desfeito com sucesso.');
      await loadGrade();
      closeAudit();
    } catch (err) {
      setError(err.message || 'Nao foi possivel desfazer ajuste.');
    } finally {
      setUndoingId(null);
    }
  }

  const selectedAdjustment = useMemo(() => (
    (auditRow?.ajustesHistorico || []).find((ajuste) => String(ajuste.id) === String(selectedAdjustmentId)) || null
  ), [auditRow, selectedAdjustmentId]);
  const canEditPunches = form.tipoAjuste === 'ALTERAR_BATIDA';
  const canUndoSelectedAdjustment = useMemo(() => {
    const history = auditRow?.ajustesHistorico || [];
    if (!selectedAdjustment) return false;
    if (selectedAdjustment.ativo) return true;
    const hasActive = history.some((ajuste) => ajuste.ativo);
    const latest = history[history.length - 1] || null;
    return !hasActive && String(latest?.id) === String(selectedAdjustment.id);
  }, [auditRow, selectedAdjustment]);

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h2>Ajustar Ponto</h2>
          <p>Grade mensal editável baseada no relógio de ponto do funcionário.</p>
        </div>
      </div>

      <div className={styles.filters}>
        <label style={{ '--field-width': `${funcionarioWidth}px` }}>
          <span>Funcionario</span>
          <select value={funcionarioId} onChange={(event) => setFuncionarioId(event.target.value)}>
            <option value="">Selecione</option>
            {funcionarios.map((funcionario) => (
              <option key={funcionario.id} value={funcionario.id}>
                {funcionario.nome}
              </option>
            ))}
          </select>
        </label>
        <label style={{ '--field-width': `${lojaWidth}px` }}>
          <span>Loja</span>
          <select value={selectedFuncionario?.lojaNome || 'Sem loja'} disabled>
            <option>{selectedFuncionario?.lojaNome || 'Sem loja'}</option>
          </select>
        </label>
        <label className={styles.periodField}>
          <span>Periodo</span>
          <MonthPicker value={mes} onChange={setMes} />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>{STATUS_LABEL[item] || item}</option>
            ))}
          </select>
        </label>
        <label className={styles.checkFilter}>
          <input type="checkbox" checked={somentePendentes} onChange={(event) => setSomentePendentes(event.target.checked)} />
          <span>Somente pendentes</span>
        </label>
      </div>

      {(error || feedback) && (
        <p className={error ? styles.error : styles.success}>{error || feedback}</p>
      )}

      <IndicadoresAjustePonto grade={grade} resumo={resumo} />

      <div className={styles.tableCard}>
        <div className={styles.tableToolbar}>
          <div>
            <CalendarDays size={14} />
            <span>{grade?.mes || mes}</span>
          </div>
          <button type="button" onClick={loadGrade} disabled={loading || !funcionarioId}>
            {loading ? <RefreshCw size={13} /> : <SlidersHorizontal size={13} />} Atualizar
          </button>
        </div>
        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia</th>
                <th>Tipo</th>
                <th>Previsto</th>
                <th>Entrada 1</th>
                <th>Saida 1</th>
                <th>Entrada 2</th>
                <th>Saida 2</th>
                <th>H. Prev.</th>
                <th>Relógio de ponto</th>
                <th>Saldo</th>
                <th>Status</th>
                <th>Pendente</th>
                <th>Ajustado</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.emptyCell} colSpan={15}>
                    <CalendarDays size={20} opacity={0.35} /> Carregando grade...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className={styles.emptyCell} colSpan={15}>
                    <Filter size={20} opacity={0.35} /> Nenhum dia encontrado.
                  </td>
                </tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.data} className={row.pendente ? styles.pendingRow : undefined} onDoubleClick={() => openEditor(row)}>
                  <td className={styles.dateCell}>{formatDateBr(row.data)}</td>
                  <td>{row.diaSemana}</td>
                  <td>{row.tipoDia}</td>
                  <td>{row.horarioPrevisto}</td>
                  <td>{row.entrada1 || '-'}</td>
                  <td>{row.saida1 || '-'}</td>
                  <td>{row.entrada2 || '-'}</td>
                  <td>{row.saida2 || '-'}</td>
                  <td>{row.horasPrevistas}</td>
                  <td>{row.horasRealizadas}</td>
                  <td className={row.saldoMinutos === null ? undefined : Number(row.saldoMinutos || 0) < 0 ? styles.negative : styles.positive}>
                    {row.saldo || '-'}
                  </td>
                  <td>
                    {row.status ? (
                      <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[row.status] || 'statusPendente']}`}>
                        {STATUS_LABEL[row.status] || row.status}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{row.pendente ? <span className={styles.pendingBadge}>Sim</span> : 'Nao'}</td>
                  <td>
                    {row.ajusteTotal > 0 ? (
                      <button className={styles.auditBtn} type="button" onClick={() => openAudit(row)} title="Ver registro do ajuste">
                        <AlertCircle size={13} />
                        {auditButtonLabel(row)}
                      </button>
                    ) : '-'}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.rowBtn}
                        type="button"
                        onClick={() => openEditor(row)}
                        disabled={row.ajustado && BLOCKING_ADJUSTMENTS.has(row.tipoAjuste)}
                        title={row.ajustado && BLOCKING_ADJUSTMENTS.has(row.tipoAjuste) ? BLOCKING_ADJUSTMENT_MESSAGE : 'Ajustar'}
                      >
                        Ajustar
                      </button>
                      {row.ajusteTotal > 0 && (
                        <button className={styles.iconBtn} type="button" onClick={() => openAudit(row)} title="Ver registro do ajuste">
                          <AlertCircle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingRow && (
        <div className={styles.modalOverlay} role="presentation">
          <form className={styles.modal} onSubmit={saveAdjustment}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Ajustar {formatDateBr(editingRow.data)}</h3>
                <p>{editingRow.diaSemana} - {STATUS_LABEL[editingRow.status] || editingRow.status}</p>
              </div>
              <button type="button" onClick={closeEditor} title="Fechar"><X size={15} /></button>
            </div>

            <div className={styles.timeGrid}>
              {[
                ['entrada1', 'Entrada 1'],
                ['saida1', 'Saida 1'],
                ['entrada2', 'Entrada 2'],
                ['saida2', 'Saida 2'],
              ].map(([name, label]) => (
                <label key={name}>
                  <span>{label}</span>
                  <input
                    type="time"
                    value={form[name]}
                    onChange={(event) => updateField(name, event.target.value)}
                    disabled={!canEditPunches}
                    title={!canEditPunches ? 'Horarios so podem ser alterados no tipo Batida.' : undefined}
                  />
                </label>
              ))}
            </div>

            <div className={styles.formGrid}>
              <label>
                <span>Tipo de ajuste</span>
                <select
                  value={form.tipoAjuste}
                  onChange={(event) => updateTipoAjuste(event.target.value)}
                  disabled={editingRow?.status === 'TRABALHADO'}
                  title={editingRow?.status === 'TRABALHADO' ? 'Dia trabalhado permite apenas alterar batidas.' : undefined}
                >
                  {(editingRow?.status === 'TRABALHADO'
                    ? TIPOS_AJUSTE.filter((tipo) => tipo.value === 'ALTERAR_BATIDA')
                    : TIPOS_AJUSTE
                  ).map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </label>
              {form.tipoAjuste === 'MARCAR_TRABALHO' && (
                <label>
                  <span>Horas previstas</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={form.metaPrevista}
                    onChange={(event) => updateField('metaPrevista', normalizeDuration(event.target.value))}
                    onBlur={(event) => {
                      const minutes = timeToMinutes(event.target.value);
                      updateField('metaPrevista', minutes ? minutesToTime(minutes) : '08:00');
                    }}
                  />
                </label>
              )}
              <label>
                <span>Motivo</span>
                <input type="text" value={form.motivo} onChange={(event) => updateField('motivo', event.target.value)} />
              </label>
              <label className={styles.fullField}>
                <span>Observacao</span>
                <textarea value={form.observacao} onChange={(event) => updateField('observacao', event.target.value)} rows={3} />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" onClick={closeEditor}>Cancelar</button>
              <button type="submit" disabled={saving}>
                <CheckCircle2 size={14} /> {saving ? 'Salvando...' : 'Salvar ajuste'}
              </button>
            </div>
          </form>
        </div>
      )}

      {auditRow && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Registros de ajuste</h3>
                <p>{formatDateBr(auditRow.data)} - {auditRow.diaSemana}</p>
              </div>
              <button type="button" onClick={closeAudit} title="Fechar"><X size={15} /></button>
            </div>

            <div className={styles.auditGrid}>
              <span>Feito por</span>
              <strong>{auditRow.ajusteCriadoPor || 'Usuario nao registrado'}</strong>
              <span>Data do ponto</span>
              <strong>{formatDateBr(auditRow.data)}</strong>
              <span>Data do ajuste</span>
              <strong>{formatAuditDateTime(auditRow.ajusteCriadoEm)}</strong>
              <span>Ajuste</span>
              <strong>{auditRow.ajusteNumero ? `Ajuste ${auditRow.ajusteNumero} - ${adjustmentLabel(auditRow.tipoAjuste)}` : '-'}</strong>
              {isPunchAdjustment(auditRow) && (
                <>
                  <span>Ajuste batida</span>
                  <strong>Antes: {originalPunchesLabel(auditRow)}</strong>
                  <span>Batida ajustada</span>
                  <strong>{adjustmentPunchesLabel(auditRow)}</strong>
                </>
              )}
              <span>Resultado atual</span>
              <strong>{STATUS_LABEL[auditRow.status] || auditRow.status || '-'}</strong>
              <span>Motivo</span>
              <strong>{auditRow.motivo || '-'}</strong>
              <span>Observacao</span>
              <strong>{auditRow.observacao || '-'}</strong>
            </div>

            <div className={styles.historyList}>
              {(auditRow.ajustesHistorico || []).map((ajuste) => (
                <button
                  key={ajuste.id}
                  className={`${styles.historyItem} ${String(selectedAdjustmentId) === String(ajuste.id) ? styles.historySelected : ''}`}
                  type="button"
                  onClick={() => setSelectedAdjustmentId(ajuste.id)}
                >
                  <div>
                    <strong>Ajuste {ajuste.numero}</strong>
                    <span>{adjustmentLabel(ajuste.tipoAjuste)}</span>
                  </div>
                  <div>
                    <span>{ajuste.createdBy || 'Usuario nao registrado'}</span>
                    <span>{formatAuditDateTime(ajuste.createdAt)}</span>
                  </div>
                  <p>{ajuste.motivo || '-'}</p>
                  {isPunchAdjustment(ajuste) && (
                    <>
                      <p>Antes: {originalPunchesLabel(ajuste)}</p>
                      <p>Ajustada: {adjustmentPunchesLabel(ajuste)}</p>
                    </>
                  )}
                  <em className={ajuste.ativo ? styles.activeHistory : styles.inactiveHistory}>
                    {ajuste.ativo ? 'Ativo' : 'Substituido'}
                  </em>
                </button>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button type="button" onClick={closeAudit}>Fechar</button>
              <button
                type="button"
                onClick={() => undoAdjustment(selectedAdjustment)}
                disabled={!canUndoSelectedAdjustment || undoingId === selectedAdjustment?.id}
                title={!canUndoSelectedAdjustment ? 'So e possivel desfazer o ultimo ajuste da lista.' : 'Desfazer ajuste selecionado'}
              >
                <RotateCcw size={14} />
                {undoingId === selectedAdjustment?.id ? 'Desfazendo...' : 'Desfazer selecionado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
