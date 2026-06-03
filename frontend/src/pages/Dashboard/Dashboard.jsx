import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './Dashboard.module.css';

const TOTAL_HOURS = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
const WEEK_DAYS = [
  { key: 1, label: 'Seg' },
  { key: 2, label: 'Ter' },
  { key: 3, label: 'Qua' },
  { key: 4, label: 'Qui' },
  { key: 5, label: 'Sex' },
  { key: 6, label: 'Sab' },
  { key: 0, label: 'Dom' },
];

const STATUS_META = {
  completo: { label: 'Completo', className: 'success' },
  'em andamento': { label: 'Em andamento', className: 'info' },
  incompleto: { label: 'Incompleto', className: 'warning' },
  falta: { label: 'Falta', className: 'danger' },
  folga: { label: 'Folga', className: 'neutral' },
  feriado: { label: 'Feriado', className: 'neutral' },
};

function useCount(target, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (typeof target !== 'number') {
      setValue(target);
      return undefined;
    }

    let frameId;
    let startTime;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setValue(Math.round(target * progress));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [duration, target]);

  return value;
}

function getStatusMeta(status) {
  return STATUS_META[String(status || '').toLowerCase()] || { label: status || 'Sem status', className: 'neutral' };
}

function formatDate(value) {
  if (!value) return 'Hoje';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date);
}

function buildHourlyFlow(funcionarios = []) {
  const map = new Map(TOTAL_HOURS.map((hour) => [hour, 0]));

  for (const item of funcionarios) {
    for (const field of ['entrada1', 'saida1', 'entrada2', 'saida2']) {
      const hour = String(item[field] || '').slice(0, 2);
      if (map.has(hour)) {
        map.set(hour, map.get(hour) + 1);
      }
    }
  }

  return [...map.entries()].map(([hour, value]) => ({ hour: `${hour}h`, value }));
}

function getWeekLabel(dateText) {
  const day = Number(String(dateText || '').slice(8, 10));
  if (!Number.isFinite(day) || day <= 0) return 'S1';
  return `S${Math.ceil(day / 7)}`;
}

function buildMonthlyTrends(rows = []) {
  const map = new Map(['S1', 'S2', 'S3', 'S4', 'S5'].map((week) => [week, {
    semana: week,
    horasExtras: 0,
    pendencias: 0,
    faltas: 0,
  }]));

  for (const row of rows) {
    const week = getWeekLabel(row.data);
    const bucket = map.get(week) || map.get('S1');
    const status = String(row.status || '').toLowerCase();
    const saldoMinutos = Number(row.saldoMinutos || 0);

    if (saldoMinutos > 0) {
      bucket.horasExtras += Math.round((saldoMinutos / 60) * 10) / 10;
    }

    if (status === 'falta') {
      bucket.faltas += 1;
    }

    if (status === 'incompleto' || status === 'em andamento' || status === 'falta') {
      bucket.pendencias += 1;
    }
  }

  return [...map.values()];
}

function buildHeatmap(rows = [], totalFuncionarios = 0) {
  const reference = rows.find((row) => row.data)?.data || new Date().toISOString().slice(0, 10);
  const [year, month] = String(reference).split('-').map(Number);
  const validYear = Number.isInteger(year) ? year : new Date().getFullYear();
  const validMonth = Number.isInteger(month) ? month : new Date().getMonth() + 1;
  const daysInMonth = new Date(validYear, validMonth, 0).getDate();
  const firstWeekday = new Date(validYear, validMonth - 1, 1).getDay();
  const byDay = new Map();

  for (const row of rows) {
    const day = Number(String(row.data || '').slice(8, 10));
    if (!Number.isFinite(day) || day <= 0) continue;
    const value = Number(row.totalBatidas || 0) > 0 ? 1 : 0;
    byDay.set(day, (byDay.get(day) || 0) + value);
  }

  const cells = [
    ...Array.from({ length: firstWeekday }, (_, index) => ({
      key: `empty-start-${index}`,
      empty: true,
    })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return {
        key: `day-${day}`,
        day,
        value: byDay.get(day) || 0,
        total: totalFuncionarios || 0,
      };
    }),
  ];

  const tail = (7 - (cells.length % 7)) % 7;
  return [
    ...cells,
    ...Array.from({ length: tail }, (_, index) => ({
      key: `empty-end-${index}`,
      empty: true,
    })),
  ];
}

function buildWeekData(rows = [], totalFuncionarios = 0) {
  const byDay = new Map(WEEK_DAYS.map((day) => [day.key, {
    dia: day.label,
    presentes: new Set(),
    ausentes: 0,
  }]));

  for (const row of rows) {
    if (!row.data) continue;
    const date = new Date(`${row.data}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const day = date.getDay();
    const bucket = byDay.get(day);
    if (!bucket) continue;

    if (Number(row.totalBatidas || 0) > 0) {
      bucket.presentes.add(String(row.matricula || row.nome || row.data));
    }

  }

  return WEEK_DAYS.map((day) => {
    const bucket = byDay.get(day.key);
    const presentes = bucket.presentes.size;
    return {
      dia: day.label,
      presentes,
      ausentes: Math.max(Number(totalFuncionarios || 0) - presentes, 0),
    };
  });
}

function StatCard({ card }) {
  const Icon = card.icon;
  const animatedValue = useCount(card.value);
  const progress = card.total > 0 ? Math.min(Math.round((Number(card.value || 0) / card.total) * 100), 100) : null;
  const interactiveProps = card.onClick ? {
    role: 'button',
    tabIndex: 0,
    onClick: card.onClick,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.onClick();
      }
    },
  } : {};

  return (
    <article className={`${styles.statCard} ${styles[card.tone]} ${card.onClick ? styles.clickableCard : ''}`} {...interactiveProps}>
      <div className={styles.statHeader}>
        <Icon size={24} />
        <em className={styles.trendBadge}>{card.trend}</em>
      </div>
      <span className={styles.statLabel}>{card.label}</span>
      <strong>{animatedValue}</strong>
      <small>{card.sub}</small>
      {progress !== null && (
        <div className={styles.statProgress}>
          <span style={{ width: `${progress}%` }} />
          <em>{progress}%</em>
        </div>
      )}
      <Sparkline data={card.spark} tone={card.tone} />
    </article>
  );
}

function Sparkline({ data = [], tone }) {
  const max = Math.max(...data, 1);
  const points = data.map((value, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * 86;
    const y = 30 - ((value / max) * 28);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className={`${styles.sparkline} ${styles[`${tone}Stroke`]}`} viewBox="0 0 86 32" aria-hidden="true">
      <polyline points={points} />
      <circle cx="86" cy={30 - ((data[data.length - 1] || 0) / max) * 28} r="2.5" />
    </svg>
  );
}

function Donut({ value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className={styles.donut} style={{ '--pct': `${pct}%` }}>
      <strong>{pct}%</strong>
      <span>presenca</span>
    </div>
  );
}

function FluxoRegistrosChart({ data, height }) {
  const chartData = data.map((item) => ({
    hora: item.hour,
    registros: item.value,
  }));
  const width = 420;
  const svgHeight = Math.max(180, height);
  const pad = { top: 18, right: 12, bottom: 28, left: 28 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = svgHeight - pad.top - pad.bottom;
  const max = Math.max(...chartData.map((item) => item.registros), 1);
  const points = chartData.map((item, index) => {
    const x = pad.left + (index * (innerWidth / Math.max(chartData.length - 1, 1)));
    const y = pad.top + innerHeight - ((item.registros / max) * innerHeight);
    return { ...item, x, y };
  });
  const areaPoints = [
    `${points[0]?.x || pad.left},${pad.top + innerHeight}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${points[points.length - 1]?.x || pad.left + innerWidth},${pad.top + innerHeight}`,
  ].join(' ');
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className={styles.flowChart}>
      <svg viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label="Fluxo de registros por hora">
        <defs>
          <linearGradient id="gFluxo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1a6b3a" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1a6b3a" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => {
          const y = pad.top + line * (innerHeight / 3);
          return <line key={line} x1={pad.left} x2={pad.left + innerWidth} y1={y} y2={y} stroke="#e0e8e2" strokeDasharray="3 3" />;
        })}
        <polygon points={areaPoints} fill="url(#gFluxo)" />
        <polyline points={linePoints} fill="none" stroke="#1a6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.hora}>
            {index % 2 === 0 && (
              <text x={point.x} y={svgHeight - 8} textAnchor="middle" fontSize="10" fill="#6b8070">{point.hora}</text>
            )}
            {point.registros > 0 && (
              <>
                <circle cx={point.x} cy={point.y} r="4" fill="#1a6b3a" stroke="#fff" strokeWidth="2" />
                <title>{`${point.hora}: ${point.registros} registros`}</title>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function PresencaSemanaChart({ data, height }) {
  const width = 420;
  const svgHeight = Math.max(180, height);
  const pad = { top: 18, right: 12, bottom: 28, left: 28 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = svgHeight - pad.top - pad.bottom;
  const max = Math.max(...data.flatMap((item) => [item.presentes, item.ausentes]), 1);
  const groupWidth = innerWidth / Math.max(data.length, 1);
  const barWidth = Math.min(22, Math.max(10, groupWidth * 0.28));

  return (
    <div className={styles.weekChart}>
      <svg viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label="Presenca na semana">
        {[0, 1, 2, 3].map((line) => {
          const y = pad.top + line * (innerHeight / 3);
          return <line key={line} x1={pad.left} x2={pad.left + innerWidth} y1={y} y2={y} stroke="#e0e8e2" strokeDasharray="3 3" />;
        })}
        {data.map((item, index) => {
          const center = pad.left + (index * groupWidth) + (groupWidth / 2);
          const presentesHeight = (item.presentes / max) * innerHeight;
          const ausentesHeight = (item.ausentes / max) * innerHeight;
          const baseY = pad.top + innerHeight;

          return (
            <g key={item.dia}>
              <rect
                x={center - barWidth - 2}
                y={baseY - presentesHeight}
                width={barWidth}
                height={presentesHeight}
                rx="5"
                fill="#1a6b3a"
              >
                <title>{`${item.dia} - Presentes: ${item.presentes}`}</title>
              </rect>
              <rect
                x={center + 2}
                y={baseY - ausentesHeight}
                width={barWidth}
                height={ausentesHeight}
                rx="5"
                fill="#c0392b"
              >
                <title>{`${item.dia} - Ausentes: ${item.ausentes}`}</title>
              </rect>
              <text x={center} y={svgHeight - 8} textAnchor="middle" fontSize="11" fill="#6b8070">{item.dia}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TrendChart({ data }) {
  const width = 420;
  const height = 132;
  const pad = 18;
  const keys = [
    ['horasExtras', styles.lineGreen, 'Horas extras'],
    ['pendencias', styles.lineAmber, 'Pendencias'],
    ['faltas', styles.lineRed, 'Faltas'],
  ];
  const max = Math.max(...data.flatMap((item) => keys.map(([key]) => Number(item[key] || 0))), 1);

  function pointList(key) {
    return data.map((item, index) => {
      const value = Number(item[key] || 0);
      const x = pad + (index * ((width - pad * 2) / Math.max(data.length - 1, 1)));
      const y = height - pad - ((value / max) * (height - pad * 2));
      return { x, y, value, semana: item.semana };
    });
  }

  return (
    <div className={styles.trendChart}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencias do mes">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2db557" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#2db557" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1={pad}
            x2={width - pad}
            y1={pad + line * ((height - pad * 2) / 3)}
            y2={pad + line * ((height - pad * 2) / 3)}
            className={styles.gridLine}
          />
        ))}
        {data.map((item, index) => {
          const x = pad + (index * ((width - pad * 2) / Math.max(data.length - 1, 1)));
          return (
            <line
              key={item.semana}
              x1={x}
              x2={x}
              y1={pad}
              y2={height - pad}
              className={styles.timeGuide}
            />
          );
        })}
        {(() => {
          const areaPoints = pointList('horasExtras');
          const areaPath = [
            `${areaPoints[0]?.x || pad},${height - pad}`,
            ...areaPoints.map((point) => `${point.x},${point.y}`),
            `${areaPoints[areaPoints.length - 1]?.x || width - pad},${height - pad}`,
          ].join(' ');
          return <polygon points={areaPath} className={styles.trendArea} />;
        })()}
        {keys.map(([key, className, label]) => {
          const points = pointList(key);
          return (
            <g key={key} className={styles.trendSeries}>
              <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} className={`${styles.trendLine} ${className}`} />
              {points.map((point) => (
                <g key={`${key}-${point.semana}`} className={styles.trendPoint}>
                  <circle cx={point.x} cy={point.y} r="4.2" className={`${styles.pointDot} ${className}`} />
                  <circle cx={point.x} cy={point.y} r="8" className={styles.pointHit} />
                  <text x={point.x} y={point.y - 11} className={styles.pointLabel}>{point.value}</text>
                  <title>{`${label} - ${point.semana}: ${point.value}`}</title>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className={styles.trendLabels}>
        {data.map((item) => <span key={item.semana}>{item.semana}</span>)}
      </div>
    </div>
  );
}

function Heatmap({ data }) {
  const max = Math.max(...data.filter((cell) => !cell.empty).map((cell) => cell.total || cell.value), 1);

  return (
    <article className={`${styles.panel} ${styles.heatmapPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <strong>Heatmap de Presenca</strong>
          <span>Funcionarios por dia no mes</span>
        </div>
      </div>

      <div className={styles.heatmapWeekdays}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className={styles.heatmapGrid}>
        {data.map((cell) => {
          if (cell.empty) {
            return <div key={cell.key} className={styles.heatEmpty} />;
          }

          const pct = cell.value / max;
          const tone = cell.value > max * 0.82
            ? 'heatHigh'
            : cell.value > max * 0.55
              ? 'heatMid'
              : cell.value > max * 0.28
                ? 'heatLow'
                : 'heatMin';

          return (
            <div
              key={cell.key}
              className={`${styles.heatCell} ${styles[tone]}`}
              style={{ '--alpha': Math.max(pct, cell.value ? 0.24 : 0.1) }}
              title={`${cell.value} presentes no dia ${cell.day}`}
            >
              {cell.value || ''}
            </div>
          );
        })}
      </div>

      <div className={styles.heatLegend}>
        <span>Menos</span>
        <i className={styles.heatMin} />
        <i className={styles.heatLow} />
        <i className={styles.heatMid} />
        <i className={styles.heatHigh} />
        <span>Mais</span>
      </div>
    </article>
  );
}

function ResumoPorLoja({ lojas, loaded }) {
  const colors = ['#1a6b3a', '#2d8f52', '#c0392b', '#e67e22', '#2a7ae0', '#7b61ff', '#008b8b', '#9b5f2e'];

  function colorForStore(name) {
    const text = String(name || 'Sem loja');
    const hash = [...text].reduce((total, char) => total + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  return (
    <div className={styles.storeSummary}>
      <div className={styles.storeSummaryTitle}>Resumo por Loja</div>
      {lojas.length === 0 && <div className={styles.emptyState}>Nenhuma loja encontrada.</div>}
      {lojas.map((loja, index) => {
        const pct = loja.total > 0 ? Math.round((loja.presentes / loja.total) * 100) : 0;
        const color = colorForStore(loja.loja);

        return (
          <div key={loja.loja} className={styles.storeSummaryItem}>
            <div className={styles.storeSummaryRow}>
              <div className={styles.storeSummaryName}>
                <i style={{ background: color }} />
                <span>{loja.loja}</span>
              </div>
              <div className={styles.storeSummaryCount}>
                <em>{pct}%</em>
                <strong style={{ color }}>{loja.presentes}/{loja.total}</strong>
              </div>
            </div>
            <div className={styles.storeSummaryProgress}>
              <span
                style={{
                  width: loaded ? `${pct}%` : '0%',
                  background: `linear-gradient(90deg, ${color}77, ${color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [time, setTime] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  const [selectedDayRow, setSelectedDayRow] = useState(null);
  const [lojasCount, setLojasCount] = useState(null);

  const loadDashboard = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');

    try {
      const [response, monthlyResponse, weeklyResponse, lojasResponse] = await Promise.all([
        fetch('/api/ponto/dashboard', {
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch('/api/ponto/apuracao?periodo=mes', {
          cache: 'no-store',
          credentials: 'include',
        }).catch(() => null),
        fetch('/api/ponto/apuracao?periodo=semana', {
          cache: 'no-store',
          credentials: 'include',
        }).catch(() => null),
        fetch('/api/lojas', {
          cache: 'no-store',
          credentials: 'include',
        }).catch(() => null),
      ]);
      const data = await response.json().catch(() => ({}));
      const monthlyData = monthlyResponse?.ok ? await monthlyResponse.json().catch(() => null) : null;
      const weeklyData = weeklyResponse?.ok ? await weeklyResponse.json().catch(() => null) : null;
      const lojasData = lojasResponse?.ok ? await lojasResponse.json().catch(() => null) : null;

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar o dashboard.');
      }

      setDashboard(data);
      if (monthlyData) {
        setMonthly(monthlyData);
      }
      if (weeklyData) {
        setWeekly(weeklyData);
      }
      if (lojasData) {
        setLojasCount((lojasData.lojas || []).length);
      }
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => loadDashboard({ quiet: true }), 10000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(timeout);
  }, []);

  const resumo = dashboard?.resumo || {};
  const funcionarios = dashboard?.funcionarios || [];
  const funcionariosComRegistroHoje = funcionarios.filter((item) => Number(item.totalBatidas || 0) > 0);
  const registrosMes = monthly?.funcionarios || [];
  const registrosSemana = weekly?.funcionarios || [];

  const derived = useMemo(() => {
    const lojas = new Map();
    const status = new Map();

    for (const item of funcionarios) {
      const loja = item.loja || 'Sem loja';
      const lojaData = lojas.get(loja) || { loja, presentes: 0, total: 0 };
      lojaData.total += 1;
      if (Number(item.totalBatidas || 0) > 0) lojaData.presentes += 1;
      lojas.set(loja, lojaData);

      const statusLabel = item.status || 'Sem status';
      status.set(statusLabel, (status.get(statusLabel) || 0) + 1);
    }

    return {
      lojas: [...lojas.values()].sort((a, b) => b.presentes - a.presentes),
      status: [...status.entries()].map(([label, value]) => ({ label, value, meta: getStatusMeta(label) })),
      hourlyFlow: buildHourlyFlow(funcionarios),
      monthlyTrends: buildMonthlyTrends(registrosMes),
      heatmap: buildHeatmap(registrosMes, resumo.funcionariosAtivos || 0),
      weekData: buildWeekData(registrosSemana, resumo.funcionariosAtivos || 0),
    };
  }, [funcionarios, registrosMes, registrosSemana, resumo.funcionariosAtivos]);

  const lojasCadastradasCount = lojasCount ?? derived.lojas.filter((loja) => loja.loja !== 'Sem loja').length;

  const stats = [
    {
      label: 'Funcionarios ativos',
      value: resumo.funcionariosAtivos || 0,
      total: resumo.funcionariosAtivos || 0,
      sub: 'cadastrados ativos',
      trend: 'base',
      icon: Users,
      tone: 'slate',
      spark: [8, 10, 11, 13, 13, resumo.funcionariosAtivos || 0],
    },
    {
      label: 'Presentes',
      value: resumo.presentesHoje || 0,
      total: resumo.funcionariosAtivos || 0,
      sub: `de ${resumo.funcionariosAtivos || 0} funcionarios`,
      trend: '+ hoje',
      icon: UserCheck,
      tone: 'green',
      spark: [4, 7, 9, 12, 10, resumo.presentesHoje || 0],
    },
    {
      label: 'Registros',
      value: resumo.registrosHoje || 0,
      total: Math.max((resumo.funcionariosAtivos || 0) * 4, 1),
      sub: 'batidas hoje',
      trend: 'ao vivo',
      icon: ClipboardList,
      tone: 'blue',
      spark: [2, 5, 7, 9, 12, resumo.registrosHoje || 0],
      onClick: () => onNavigate?.('apuracao', {
        periodo: 'hoje',
        filtersOpen: true,
        filters: { registros: 'comRegistro' },
      }),
    },
    {
      label: 'Pendencias',
      value: resumo.pendencias || 0,
      total: resumo.funcionariosAtivos || 0,
      sub: 'para conferir',
      trend: 'acao',
      icon: AlertCircle,
      tone: 'red',
      spark: [1, 3, 2, 4, 2, resumo.pendencias || 0],
    },
    {
      label: 'Extras do mes',
      value: Math.round(derived.monthlyTrends.reduce((total, item) => total + item.horasExtras, 0)),
      total: null,
      sub: 'horas positivas',
      trend: '+ mes',
      icon: Zap,
      tone: 'green',
      spark: derived.monthlyTrends.map((item) => item.horasExtras),
    },
  ];
  const chartHeight = Math.min(460, Math.max(220, 70 + (derived.lojas.length * 36)));

  return (
    <div className={`${styles.page} ${loaded ? styles.loaded : ''}`}>
      <section className={styles.hero}>
        <div>
          <div className={styles.liveRow}>
            <span className={styles.liveDot} />
            <span>Ao vivo</span>
            <em>{formatDate(dashboard?.data)}</em>
          </div>
          <h1>Dashboard de <span>Ponto</span></h1>
        </div>

        <div className={styles.clockPanel}>
          <span>{time.toLocaleTimeString('pt-BR')}</span>
          <div className={styles.headerChips}>
            <div>{lojasCadastradasCount} Lojas</div>
            <div>{resumo.funcionariosAtivos || 0} Func.</div>
          </div>
        </div>
      </section>

      {error && <div className={styles.errorState}>{error}</div>}

      <section className={styles.statsGrid}>
        {stats.map((card) => <StatCard key={card.label} card={card} />)}
      </section>

      <section className={styles.topGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <strong>Fluxo de registros</strong>
              <span>Batidas recentes agrupadas por hora</span>
            </div>
            <Activity size={17} />
          </div>
          {loading ? (
            <div className={styles.emptyState}>Carregando indicadores...</div>
          ) : (
            <FluxoRegistrosChart data={derived.hourlyFlow} height={chartHeight} />
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <strong>Presenca na Semana</strong>
              <span>Presentes · Ausentes</span>
            </div>
            <div className={styles.weekLegend}>
              <span><i className={styles.legendGreen} />P</span>
              <span><i className={styles.legendRed} />A</span>
            </div>
          </div>
          {loading ? (
            <div className={styles.emptyState}>Carregando semana...</div>
          ) : (
            <PresencaSemanaChart data={derived.weekData} height={chartHeight} />
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <strong>Status atual</strong>
              <span>Distribuicao da equipe no dia</span>
            </div>
            <CheckCircle2 size={17} />
          </div>
          <div className={styles.statusBody}>
            <Donut value={resumo.presentesHoje || 0} total={resumo.funcionariosAtivos || 0} />
            <div className={styles.statusList}>
              {derived.status.length === 0 && <span className={styles.mutedText}>Sem status para exibir.</span>}
              {derived.status.map((item) => (
                <div key={item.label} className={styles.statusItem}>
                  <span className={`${styles.statusMark} ${styles[item.meta.className]}`} />
                  <em>{item.meta.label}</em>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <ResumoPorLoja lojas={derived.lojas} loaded={loaded} />
        </article>
      </section>

      <section className={styles.dayRecordsGrid}>
        <article className={`${styles.panel} ${styles.dayPanel}`}>
          <div className={styles.dayHeader}>
            <div>
              <strong>Registros de Hoje</strong>
              <span>Clique na linha para detalhes</span>
            </div>
            <div className={styles.dayHeaderActions}>
              <em>{funcionariosComRegistroHoje.length} func.</em>
              <button
                type="button"
                onClick={() => onNavigate?.('apuracao', {
                  periodo: 'hoje',
                  filtersOpen: true,
                  filters: {},
                })}
              >
                Ver mais
              </button>
            </div>
          </div>

          <div className={styles.dayTableWrap}>
            <table className={styles.dayTable}>
              <thead>
                <tr>
                  <th>Funcionario</th>
                  <th>Loja</th>
                  <th>Entrada</th>
                  <th>Saida</th>
                  <th>Entrada</th>
                  <th>Saida</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="6" className={styles.dayEmpty}>Carregando registros...</td>
                  </tr>
                )}
                {!loading && funcionariosComRegistroHoje.length === 0 && (
                  <tr>
                    <td colSpan="6" className={styles.dayEmpty}>Nenhum funcionário com registro hoje.</td>
                  </tr>
                )}
                {!loading && funcionariosComRegistroHoje.slice(0, 14).map((item) => {
                  const meta = getStatusMeta(item.status);
                  const initial = String(item.nome || item.matricula || '?').charAt(0);

                  return (
                    <tr
                      key={item.matricula}
                      className={selectedDayRow === item.matricula ? styles.daySelected : ''}
                      onClick={() => setSelectedDayRow(selectedDayRow === item.matricula ? null : item.matricula)}
                    >
                      <td>
                        <div className={styles.dayPerson}>
                          <span className={styles[meta.className]}>{initial}</span>
                          <strong>{item.nome || `Matricula ${item.matricula}`}</strong>
                        </div>
                      </td>
                      <td>{item.loja || '-'}</td>
                      <td className={item.entrada1 ? styles.timeValue : styles.noValue}>{item.entrada1 || '-'}</td>
                      <td className={item.saida1 ? styles.timeValue : styles.noValue}>{item.saida1 || '-'}</td>
                      <td className={item.entrada2 ? styles.timeValue : styles.noValue}>{item.entrada2 || '-'}</td>
                      <td className={item.saida2 ? styles.timeValue : styles.noValue}>{item.saida2 || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <Heatmap data={derived.heatmap} />
      </section>
    </div>
  );
}
