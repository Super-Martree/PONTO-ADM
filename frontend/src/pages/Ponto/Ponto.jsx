import { apiFetch } from '../../utils/api';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock, ClipboardList, Download, Filter, Hourglass, LogOut, MapPin, RefreshCw, Wallet } from 'lucide-react';
import MonthPicker from '../../components/MonthPicker/MonthPicker';
import PontoDoMesPage from '../PontoDoMes/PontoDoMesPage';
import RecordsTable from './components/RecordsTable';
import { parseDateBrInput, todayBrDateInput } from '../../utils/date';
import styles from './Ponto.module.css';

const PUNCH_SLOTS = [
  { tipo: 'entrada1', letter: 'E', label: 'Entrada' },
  { tipo: 'saida1', letter: 'S', label: 'Saída' },
  { tipo: 'entrada2', letter: 'E', label: 'Entrada' },
  { tipo: 'saida2', letter: 'S', label: 'Saída' },
];

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function formatMinutes(totalMinutes, { signed = false } = {}) {
  const value = Number(totalMinutes || 0);
  const sign = value < 0 ? '-' : signed ? '+' : '';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function calculateWorkedMinutes(resumo = {}) {
  const entrada1 = timeToMinutes(resumo.entrada1);
  const saida1 = timeToMinutes(resumo.saida1);
  const entrada2 = timeToMinutes(resumo.entrada2);
  const saida2 = timeToMinutes(resumo.saida2);
  let total = 0;

  if (entrada1 !== null && saida1 !== null && saida1 >= entrada1) {
    total += saida1 - entrada1;
  }

  if (entrada2 !== null && saida2 !== null && saida2 >= entrada2) {
    total += saida2 - entrada2;
  }

  return total;
}

function todayMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

function formatDateBr(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value || '-';
}

export default function Ponto({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('ponto');
  const [now, setNow] = useState(() => new Date());
  const ringRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [validacaoLocalizacaoAtiva, setValidacaoLocalizacaoAtiva] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acquiringLocation, setAcquiringLocation] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [periodo, setPeriodo] = useState('geral');
  const [customStart, setCustomStart] = useState(todayBrDateInput);
  const [customEnd, setCustomEnd] = useState(todayBrDateInput);
  const [registros, setRegistros] = useState([]);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [registrosError, setRegistrosError] = useState('');
  const [bancoPeriodo, setBancoPeriodo] = useState(todayMonth);
  const [bancoHoras, setBancoHoras] = useState(null);
  const [loadingBancoHoras, setLoadingBancoHoras] = useState(false);
  const [bancoHorasError, setBancoHorasError] = useState('');
  const latestRecord = status?.batidas?.[status.batidas.length - 1];
  const workedMinutes = calculateWorkedMinutes(status?.resumo);
  const dailyGoalMinutes = Number.isFinite(Number(status?.resumo?.esperadoMinutos))
    ? Number(status.resumo.esperadoMinutos)
    : 8 * 60;
  const balanceMinutes = workedMinutes - dailyGoalMinutes;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = ringRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const width = 280;
    const center = 140;
    const twoPi = Math.PI * 2;
    const start = -Math.PI / 2;

    function arc(pct, radius, color, lineWidth) {
      ctx.beginPath();
      ctx.arc(center, center, radius, start, start + twoPi * pct);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    function dot(pct, radius, color) {
      const angle = start + twoPi * pct;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, twoPi);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.clearRect(0, 0, width, width);

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const secondPct = ((minutes * 60) + seconds) / 3600;
    const hourPct = (((hours % 12) * 60) + minutes) / 720;
    const dayPct = ((hours * 60) + minutes) / (24 * 60);

    arc(1, 128, '#1A2A22', 2);
    arc(1, 108, '#1A2A22', 2);
    arc(1, 88, '#1A2A22', 2);
    arc(dayPct, 128, '#1D3A2C', 14);
    arc(Math.min(dayPct, 1), 128, '#0F4D38', 3);
    arc(hourPct, 108, '#0D2E22', 14);
    arc(Math.min(hourPct, 1), 108, '#1D9E75', 3);
    if (hourPct > 0) dot(hourPct, 108, '#5DCAA5');
    arc(secondPct, 88, '#0D2030', 14);
    arc(secondPct, 88, '#185FA5', 2);
    if (secondPct > 0) dot(secondPct, 88, '#378ADD');
  }, [now]);

  useEffect(() => {
    loadTodayStatus();
    loadLocalizacaoConfig();
  }, [user?.matricula]);

  useEffect(() => {
    if (activeTab === 'registros') {
      loadRegistros();
    }
  }, [activeTab, periodo, customStart, customEnd, user?.matricula]);

  useEffect(() => {
    if (activeTab === 'banco-horas') {
      loadBancoHoras();
    }
  }, [activeTab, bancoPeriodo, user?.matricula]);

  const limiteAtingido = Boolean(status?.resumo?.limiteAtingido);
  const registrosResumo = (() => {
    const today = todayIso();
    const comRegistro = registros.filter((row) => Number(row.totalBatidas || 0) > 0).length;
    const incompletos = registros.filter((row) => row.status === 'Incompleto').length;
    const pendencias = registros.filter((row) => isClosedPendingDay(row, today)).length;

    return {
      registros: String(comRegistro).padStart(2, '0'),
      pendencias: String(pendencias).padStart(2, '0'),
      incompletos: String(incompletos).padStart(2, '0'),
    };
  })();
  const registrosIndicadores = [
    { label: 'Registros', value: registrosResumo.registros, tone: 'green', icon: ClipboardList },
    { label: 'Pendencias', value: registrosResumo.pendencias, tone: 'red', icon: AlertTriangle },
    { label: 'Incompletos', value: registrosResumo.incompletos, tone: 'amber', icon: Hourglass },
  ];
  const bancoFuncionario = bancoHoras?.funcionarios?.[0] || null;
  const bancoMovimentos = bancoFuncionario?.movimentos || [];
  const bancoResumo = [
    { label: 'Saldo geral', value: bancoFuncionario?.saldoGeral || '+00:00', minutes: bancoFuncionario?.saldoGeralMinutos, icon: Wallet },
    { label: 'Saldo do mes', value: bancoFuncionario?.saldoPeriodo || '+00:00', minutes: bancoFuncionario?.saldoPeriodoMinutos, icon: Clock },
    { label: 'Ponto', value: bancoFuncionario?.saldoPonto || '+00:00', minutes: bancoFuncionario?.saldoPontoMinutos, icon: ClipboardList },
    { label: 'Manual', value: bancoFuncionario?.saldoManual || '+00:00', minutes: bancoFuncionario?.saldoManualMinutos, icon: Hourglass },
  ];

  async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Nao foi possivel processar a solicitacao.');
    }

    return data;
  }

  async function loadTodayStatus() {
    setLoadingStatus(true);

    try {
      const response = await apiFetch('/api/ponto/hoje', {
        credentials: 'include',
      });
      const data = await readResponse(response);
      setStatus(data);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadLocalizacaoConfig() {
    try {
      const response = await apiFetch('/api/configuracoes/localizacao', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await readResponse(response);
      setValidacaoLocalizacaoAtiva(Boolean(data.configuracao?.validacaoLocalizacaoAtiva));
    } catch {
      setValidacaoLocalizacaoAtiva(false);
    }
  }

  async function loadRegistros() {
    const params = new URLSearchParams({ periodo });

    if (periodo === 'personalizado') {
      params.set('inicio', parseDateBrInput(customStart));
      params.set('fim', parseDateBrInput(customEnd));
    }

    setLoadingRegistros(true);
    setRegistrosError('');

    try {
      const response = await apiFetch(`/api/ponto/registros?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await readResponse(response);
      setRegistros(data.dias || []);
    } catch (error) {
      setRegistrosError(error.message);
    } finally {
      setLoadingRegistros(false);
    }
  }

  async function loadBancoHoras() {
    const [ano, mes] = bancoPeriodo.split('-');
    const params = new URLSearchParams({ ano, mes });

    setLoadingBancoHoras(true);
    setBancoHorasError('');

    try {
      const response = await apiFetch(`/api/banco-horas?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await readResponse(response);
      setBancoHoras(data);
    } catch (error) {
      setBancoHorasError(error.message);
    } finally {
      setLoadingBancoHoras(false);
    }
  }

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Este navegador nao permite capturar localizacao.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            capturedAt: new Date(position.timestamp).toISOString(),
          });
        },
        () => reject(new Error('Autorize a localizacao para registrar o ponto.')),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        },
      );
    });
  }

  async function registerPoint(event) {
    event.preventDefault();
    setFeedback(null);

    setAcquiringLocation(validacaoLocalizacaoAtiva);
    setSaving(true);

    try {
      const location = validacaoLocalizacaoAtiva ? await getCurrentLocation() : null;
      const response = await apiFetch('/api/ponto/bater', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(location ? { location } : {}),
      });
      const data = await readResponse(response);
      setFeedback({ type: 'success', message: data.message });
      await loadTodayStatus();
      if (activeTab === 'registros') {
        await loadRegistros();
      }
      if (activeTab === 'banco-horas') {
        await loadBancoHoras();
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setAcquiringLocation(false);
      setSaving(false);
    }
  }

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <img src="/martri-mascote.png" alt="Martree" />
          <div>
            <strong>Martree</strong>
            <span>Funcionário</span>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Menu do funcionário">
          <button
            className={`${styles.navBtn} ${activeTab === 'ponto' ? styles.active : ''}`}
            type="button"
            onClick={() => setActiveTab('ponto')}
          >
            <Clock size={15} />
            <span className={styles.navLabel}>Ponto</span>
          </button>
          <button
            className={`${styles.navBtn} ${activeTab === 'registros' ? styles.active : ''}`}
            type="button"
            onClick={() => setActiveTab('registros')}
          >
            <ClipboardList size={15} />
            <span className={styles.navLabel}>Registros</span>
          </button>
          <button
            className={`${styles.navBtn} ${activeTab === 'escala-mes' ? styles.active : ''}`}
            type="button"
            onClick={() => setActiveTab('escala-mes')}
          >
            <CalendarDays size={15} />
            <span className={styles.navLabel}>Escala Mês</span>
          </button>
          <button
            className={`${styles.navBtn} ${activeTab === 'banco-horas' ? styles.active : ''}`}
            type="button"
            onClick={() => setActiveTab('banco-horas')}
          >
            <Wallet size={15} />
            <span className={styles.navLabel}>Banco de Horas</span>
          </button>
        </nav>

        <div className={styles.footer}>
          <div>
            <strong>{user?.name || 'Funcionário'}</strong>
            <span>Matrícula {user?.matricula}</span>
          </div>
          <button type="button" onClick={onLogout} title="Sair">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <main className={`${styles.main} ${activeTab !== 'ponto' ? styles.mainTop : ''}`}>
        {activeTab === 'ponto' ? (
          <section className={styles.shell} aria-label="Registro de ponto">
            <div className={styles.employeeRow}>
              <div className={styles.avatar}>
                {(user?.name || 'Funcionário')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div className={styles.employeeInfo}>
                <div className={styles.employeeName}>{user?.name || 'Funcionário'}</div>
                <div className={styles.employeeMeta}>Matrícula {user?.matricula}</div>
              </div>
              <div className={styles.dateChip}>{now.toLocaleDateString('pt-BR')}</div>
            </div>

            <div className={styles.clockRing}>
              <canvas ref={ringRef} width="280" height="280" />
              <div className={styles.clockCenter}>
                <div className={styles.clockTimeRow}>
                  <span className={styles.clockTime}>
                    {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={styles.clockSeconds}>{String(now.getSeconds()).padStart(2, '0')}</span>
                </div>
                <div className={styles.clockLabel}>hora atual</div>
              </div>
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={`${styles.statValue} ${styles.statGreen}`}>{formatMinutes(workedMinutes)}</div>
                <div className={styles.statLabel}>trabalhado</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{formatMinutes(dailyGoalMinutes)}</div>
                <div className={styles.statLabel}>meta diária</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{formatMinutes(balanceMinutes, { signed: true })}</div>
                <div className={styles.statLabel}>saldo</div>
              </div>
            </div>

            <div className={styles.punchPreview} aria-label="Sequência visual de registros">
              {PUNCH_SLOTS.map((slot) => {
                const hora = status?.resumo?.[slot.tipo];
                return (
                  <div
                    key={slot.tipo}
                    className={`${styles.punchSlot} ${hora ? styles.punchSlotMarked : ''}`}
                  >
                    <span>{slot.letter}</span>
                    <strong>{slot.label}</strong>
                    {hora && <small>{hora}</small>}
                  </div>
                );
              })}
            </div>

            <form className={styles.punchForm} onSubmit={registerPoint}>
              <button className={styles.action} type="submit" disabled={saving || loadingStatus || limiteAtingido}>
                {acquiringLocation ? <MapPin size={18} /> : <Clock size={18} />}
                {acquiringLocation && validacaoLocalizacaoAtiva ? 'Capturando localizacao...' : saving ? 'Registrando...' : limiteAtingido ? 'Limite diário atingido' : 'Registrar ponto'}
              </button>
            </form>

            {feedback && (
              <p className={feedback.type === 'success' ? styles.success : styles.error}>{feedback.message}</p>
            )}

            {latestRecord && !feedback && (
              <p className={styles.success}>Último ponto registrado às {latestRecord.hora_ponto}.</p>
            )}
          </section>
        ) : activeTab === 'registros' ? (
          <section className={styles.recordsPage} aria-label="Registros de ponto">
            <div className={styles.pageHeader}>
              <div className={styles.indicators}>
                {registrosIndicadores.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className={`${styles.indicatorCard} ${styles[item.tone]}`}>
                      <span className={styles.indicatorIcon}><Icon size={20} /></span>
                      <div>
                        <small>{item.label}</small>
                        <strong>{item.value}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.pageActions}>
                <button type="button" onClick={loadRegistros}><Filter size={13} /> Atualizar</button>
                <button type="button"><Download size={13} /> Exportar</button>
              </div>
            </div>

            <div className={styles.recordsFilters}>
              <div className={styles.periodTabs}>
                {[
                  ['geral', 'Geral'],
                  ['semana', 'Semana'],
                  ['mes', 'Mês'],
                  ['personalizado', 'Personalizado'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={periodo === value ? styles.periodActive : ''}
                    type="button"
                    onClick={() => setPeriodo(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {periodo === 'personalizado' && (
                <div className={styles.customDates}>
                  <label>
                    <span>Inicio</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>

            {registrosError && <p className={styles.error}>{registrosError}</p>}
            {loadingRegistros && <p className={styles.success}>Carregando registros...</p>}
            <RecordsTable rows={registros} />
          </section>
        ) : activeTab === 'escala-mes' ? (
          <section className={styles.recordsPage} aria-label="Escala mes">
            <PontoDoMesPage employeeMode user={user} />
          </section>
        ) : (
          <section className={styles.recordsPage} aria-label="Banco de horas">
            <div className={styles.bancoHeader}>
              <div>
                <h2>Banco de Horas</h2>
                <p>{user?.name || 'Funcionario'} - matricula {user?.matricula}</p>
              </div>
              <div className={styles.bancoActions}>
                <MonthPicker value={bancoPeriodo} onChange={setBancoPeriodo} disabled={loadingBancoHoras} />
                <button type="button" onClick={loadBancoHoras} disabled={loadingBancoHoras}>
                  <RefreshCw size={13} /> Atualizar
                </button>
              </div>
            </div>

            {bancoHorasError && <p className={styles.error}>{bancoHorasError}</p>}
            {loadingBancoHoras && <p className={styles.success}>Carregando banco de horas...</p>}

            <div className={styles.bancoSummaryGrid}>
              {bancoResumo.map((item) => {
                const Icon = item.icon;
                const negative = Number(item.minutes || 0) < 0;

                return (
                  <div key={item.label} className={styles.bancoSummaryCard}>
                    <Icon size={18} />
                    <small>{item.label}</small>
                    <strong className={negative ? styles.negativeText : styles.positiveText}>{item.value}</strong>
                  </div>
                );
              })}
            </div>

            <section className={styles.bancoTablePanel}>
              <table className={styles.bancoTable}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Origem</th>
                    <th>Horas</th>
                    <th>Descricao</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadingBancoHoras && bancoMovimentos.length === 0 && (
                    <tr>
                      <td colSpan="4" className={styles.bancoEmpty}>Nenhum movimento no periodo.</td>
                    </tr>
                  )}
                  {bancoMovimentos.map((movimento, index) => (
                    <tr key={`${movimento.origem}-${movimento.id || movimento.data}-${index}`}>
                      <td>{formatDateBr(movimento.data)}</td>
                      <td>
                        <span className={styles.bancoTag}>{movimento.origem === 'manual' ? 'Manual' : 'Ponto'}</span>
                      </td>
                      <td className={Number(movimento.minutos || 0) < 0 ? styles.negativeText : styles.positiveText}>
                        {movimento.saldo || formatMinutes(movimento.minutos, { signed: true })}
                      </td>
                      <td>{movimento.descricao || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
