import { CalendarDays, Pause, Play, Plus, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './EscalasModelosPage.module.css';

const DIAS = [
  { key: 'segunda', label: 'Seg', dia_semana: 1 },
  { key: 'terca', label: 'Ter', dia_semana: 2 },
  { key: 'quarta', label: 'Qua', dia_semana: 3 },
  { key: 'quinta', label: 'Qui', dia_semana: 4 },
  { key: 'sexta', label: 'Sex', dia_semana: 5 },
  { key: 'sabado', label: 'Sab', dia_semana: 6 },
  { key: 'domingo', label: 'Dom', dia_semana: 7 },
];

const TIPO_INFO = {
  fixa: { label: 'Fixa', desc: 'Mesmo total de horas nos dias ativos' },
  flexivel: { label: 'Flexivel', desc: 'Horas diferentes por dia da semana' },
  ciclo: { label: 'Ciclo semanal', desc: 'Semanas alternadas com cargas distintas' },
};

function defaultConfigByTipo(tipo) {
  if (tipo === 'fixa') {
    return { horasPorDia: 8, diasAtivos: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] };
  }

  if (tipo === 'ciclo') {
    return { semanas: [makeDefaultWeek()] };
  }

  const dias = {};
  DIAS.forEach((dia) => {
    dias[dia.key] = dia.key === 'sabado' || dia.key === 'domingo' ? null : 8;
  });
  return { dias };
}

function makeDefaultWeek() {
  const dias = {};
  DIAS.forEach((dia) => {
    dias[dia.key] = dia.key === 'sabado' || dia.key === 'domingo' ? null : 8;
  });
  return { dias };
}

function minutesToHours(minutes) {
  return Number(((Number(minutes || 0)) / 60).toFixed(1));
}

function configFromDias(escala) {
  if (escala.configuracao) return escala.configuracao;

  const dias = {};
  DIAS.forEach((dia) => {
    const meta = escala.dias?.find((item) => item.dia_semana === dia.dia_semana)?.meta_minutos || 0;
    dias[dia.key] = meta > 0 ? minutesToHours(meta) : null;
  });

  if (escala.tipo === 'flexivel') return { dias };
  if (escala.tipo === 'ciclo') return { semanas: [{ dias }] };

  const activeValues = Object.values(dias).filter((value) => value !== null);
  return {
    horasPorDia: activeValues[0] || 8,
    diasAtivos: DIAS.filter((dia) => dias[dia.key] !== null).map((dia) => dia.key),
  };
}

function diasFromConfig(tipo, config) {
  if (tipo === 'fixa') {
    return DIAS.map((dia) => ({
      dia_semana: dia.dia_semana,
      meta_minutos: (config.diasAtivos || []).includes(dia.key) ? Math.round(Number(config.horasPorDia || 0) * 60) : 0,
    }));
  }

  if (tipo === 'ciclo') {
    const semanas = config.semanas?.length ? config.semanas : [makeDefaultWeek()];
    return DIAS.map((dia) => {
      const total = semanas.reduce((sum, semana) => sum + (semana.dias?.[dia.key] || 0), 0);
      return { dia_semana: dia.dia_semana, meta_minutos: Math.round((total / semanas.length) * 60) };
    });
  }

  return DIAS.map((dia) => ({
    dia_semana: dia.dia_semana,
    meta_minutos: config.dias?.[dia.key] === null ? 0 : Math.round(Number(config.dias?.[dia.key] || 0) * 60),
  }));
}

function calcTotal(tipo, config) {
  if (tipo === 'fixa') return Number(config.horasPorDia || 0) * (config.diasAtivos?.length || 0);
  if (tipo === 'flexivel') return Object.values(config.dias || {}).reduce((sum, value) => sum + (value || 0), 0);
  if (tipo === 'ciclo') {
    const semanas = config.semanas || [];
    if (!semanas.length) return 0;
    const total = semanas.reduce((sum, semana) => (
      sum + Object.values(semana.dias || {}).reduce((daySum, value) => daySum + (value || 0), 0)
    ), 0);
    return total / semanas.length;
  }
  return 0;
}

function formatHours(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function Preview({ tipo, config }) {
  if (tipo === 'ciclo') {
    return (
      <div className={styles.cyclePreview}>
        {(config.semanas || []).map((semana, index) => {
          const total = Object.values(semana.dias || {}).reduce((sum, value) => sum + (value || 0), 0);
          return (
            <div key={index} className={styles.weekChip}>
              <span>S{index + 1}</span>
              <strong>{formatHours(total)}h</strong>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.previewRow}>
      {DIAS.map((dia) => {
        const value = tipo === 'fixa'
          ? (config.diasAtivos || []).includes(dia.key) ? config.horasPorDia : null
          : config.dias?.[dia.key];
        const active = value !== null && value !== undefined && Number(value) > 0;

        return (
          <div key={dia.key} className={`${styles.dayChip} ${active ? styles.dayActive : styles.dayOff}`}>
            <span>{dia.label}</span>
            <strong>{active ? `${formatHours(value)}h` : '-'}</strong>
          </div>
        );
      })}
    </div>
  );
}

function EscalaCard({ escala, onToggle }) {
  const tipo = escala.tipo || 'fixa';
  const config = configFromDias(escala);
  const total = calcTotal(tipo, config);

  return (
    <article className={`${styles.scaleCard} ${!escala.ativo ? styles.inactiveCard : ''}`}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.nameRow}>
            <h3>{escala.nome}</h3>
            <span className={`${styles.typeBadge} ${styles[`type_${tipo}`]}`}>{TIPO_INFO[tipo]?.label || 'Fixa'}</span>
          </div>
          <div className={styles.cardInfo}>
            <span>{formatHours(total)}h / semana</span>
            <em className={escala.ativo ? styles.statusActive : styles.statusInactive}>
              {escala.ativo ? 'ativa' : 'inativa'}
            </em>
          </div>
        </div>
        <div className={styles.cardActions}>
          <button type="button" onClick={() => onToggle(escala)} title={escala.ativo ? 'Inativar' : 'Ativar'}>
            {escala.ativo ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
      </div>
      <Preview tipo={tipo} config={config} />
    </article>
  );
}

function EscalaForm({ inicial, onSave, onCancel, saving }) {
  const [nome, setNome] = useState(inicial?.nome || '');
  const [tipo, setTipo] = useState(inicial?.tipo || 'fixa');
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [config, setConfig] = useState(inicial ? configFromDias(inicial) : defaultConfigByTipo('fixa'));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!inicial) setConfig(defaultConfigByTipo(tipo));
  }, [inicial, tipo]);

  function changeTipo(nextTipo) {
    setTipo(nextTipo);
    setConfig(defaultConfigByTipo(nextTipo));
  }

  function validate() {
    const nextErrors = {};
    if (!nome.trim()) nextErrors.nome = 'Nome obrigatorio';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function submit(event) {
    event.preventDefault();
    if (!validate()) return;
    onSave({
      nome: nome.trim(),
      tipo,
      ativo,
      configuracao: config,
      dias: diasFromConfig(tipo, config),
    });
  }

  function toggleDiaFixa(key) {
    setConfig((current) => {
      const ativos = current.diasAtivos || [];
      const next = ativos.includes(key) ? ativos.filter((dia) => dia !== key) : [...ativos, key];
      return { ...current, diasAtivos: next };
    });
  }

  function setFlexDia(key, value) {
    setConfig((current) => ({ ...current, dias: { ...current.dias, [key]: value } }));
  }

  function addSemana() {
    setConfig((current) => ({ ...current, semanas: [...(current.semanas || []), makeDefaultWeek()] }));
  }

  function removeSemana(index) {
    setConfig((current) => ({ ...current, semanas: current.semanas.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function setCicloDia(semanaIndex, key, value) {
    setConfig((current) => {
      const semanas = [...current.semanas];
      semanas[semanaIndex] = {
        ...semanas[semanaIndex],
        dias: { ...semanas[semanaIndex].dias, [key]: value },
      };
      return { ...current, semanas };
    });
  }

  const totalHoras = calcTotal(tipo, config);

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.typeGrid}>
        {Object.entries(TIPO_INFO).map(([key, info]) => (
          <button
            key={key}
            type="button"
            className={`${styles.typeCard} ${tipo === key ? styles.typeActive : ''}`}
            onClick={() => changeTipo(key)}
          >
            <strong>{info.label}</strong>
            <span>{info.desc}</span>
          </button>
        ))}
      </div>

      <div className={styles.formGrid}>
        <label className={styles.fieldGroup}>
          <span>Nome da escala</span>
          <input
            className={errors.nome ? styles.inputError : ''}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="ex: Turno manha, Escala CPD"
            autoFocus
          />
          {errors.nome && <em>{errors.nome}</em>}
        </label>
        <label className={styles.activeField}>
          <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
          <span>Escala ativa</span>
        </label>
      </div>

      {tipo === 'fixa' && (
        <section className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h4>Horas diarias</h4>
            <span className={styles.totalPill}>{formatHours(totalHoras)}h por semana</span>
          </div>
          <div className={styles.fixedRow}>
            <input
              className={styles.hoursInput}
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={config.horasPorDia}
              onChange={(event) => setConfig((current) => ({ ...current, horasPorDia: Number(event.target.value) || 0 }))}
            />
            <span>h / dia</span>
          </div>
          <div className={styles.daysRow}>
            {DIAS.map((dia) => (
              <button
                key={dia.key}
                type="button"
                className={`${styles.dayButton} ${(config.diasAtivos || []).includes(dia.key) ? styles.dayButtonActive : ''}`}
                onClick={() => toggleDiaFixa(dia.key)}
              >
                {dia.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tipo === 'flexivel' && (
        <section className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h4>Horas por dia</h4>
            <span className={styles.totalPill}>{formatHours(totalHoras)}h / semana</span>
          </div>
          <div className={styles.flexGrid}>
            {DIAS.map((dia) => (
              <DayEditor
                key={dia.key}
                label={dia.label}
                value={config.dias?.[dia.key]}
                onChange={(value) => setFlexDia(dia.key, value)}
              />
            ))}
          </div>
        </section>
      )}

      {tipo === 'ciclo' && (
        <section className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h4>Semanas do ciclo</h4>
            <button type="button" className={styles.addButton} onClick={addSemana}>+ Semana</button>
          </div>
          <span className={styles.totalPill}>Media: {formatHours(totalHoras)}h / semana</span>
          {(config.semanas || []).map((semana, index) => {
            const totalSemana = Object.values(semana.dias || {}).reduce((sum, value) => sum + (value || 0), 0);
            return (
              <div key={index} className={styles.weekCard}>
                <div className={styles.weekHeader}>
                  <strong>Semana {index + 1}</strong>
                  <span>{formatHours(totalSemana)}h</span>
                  {(config.semanas || []).length > 1 && (
                    <button type="button" onClick={() => removeSemana(index)}>remover</button>
                  )}
                </div>
                <div className={styles.flexGrid}>
                  {DIAS.map((dia) => (
                    <DayEditor
                      key={dia.key}
                      label={dia.label}
                      value={semana.dias?.[dia.key]}
                      onChange={(value) => setCicloDia(index, dia.key, value)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={styles.btnPrimary} disabled={saving}>
          <Save size={13} /> {saving ? 'Salvando...' : inicial ? 'Salvar alteracoes' : 'Criar escala'}
        </button>
      </div>
    </form>
  );
}

function DayEditor({ label, value, onChange }) {
  const isOff = value === null || value === undefined;

  return (
    <div className={styles.dayEditor}>
      <span>{label}</span>
      {isOff ? (
        <>
          <strong>Folga</strong>
          <button type="button" onClick={() => onChange(8)}>ativar</button>
        </>
      ) : (
        <>
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={value}
            onChange={(event) => onChange(Number(event.target.value) || 0)}
          />
          <button type="button" onClick={() => onChange(null)}>folga</button>
        </>
      )}
    </div>
  );
}

export default function EscalasModelosPage() {
  const [escalas, setEscalas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadEscalas = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/escalas', { cache: 'no-store', credentials: 'include' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar escalas.');
      }

      setEscalas(data.escalas || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEscalas();
  }, [loadEscalas]);

  const stats = useMemo(() => ({
    total: escalas.length,
    ativas: escalas.filter((escala) => escala.ativo).length,
    inativas: escalas.filter((escala) => !escala.ativo).length,
  }), [escalas]);

  function openNewEscala() {
    setFeedback(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function saveEscala(payload) {
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/escalas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel salvar escala.');
      }

      setFeedback({ type: 'success', message: data.message });
      closeModal();
      await loadEscalas();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(escala) {
    setFeedback(null);

    try {
      const response = await fetch(`/api/escalas/${escala.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo: !escala.ativo }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel alterar status.');
      }

      setFeedback({ type: 'success', message: data.message });
      await loadEscalas();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2>Modelos de Escala</h2>
          <p>Cadastre modelos fixos, flexiveis ou por ciclo semanal.</p>
        </div>
        <button className={styles.btnPrimary} type="button" onClick={openNewEscala}>
          <Plus size={13} /> Nova Escala
        </button>
      </div>

      {feedback && <p className={feedback.type === 'success' ? styles.success : styles.error}>{feedback.message}</p>}

      <div className={styles.statsGrid}>
        <div><small>Total</small><strong>{stats.total}</strong></div>
        <div><small>Ativas</small><strong>{stats.ativas}</strong></div>
        <div><small>Inativas</small><strong>{stats.inativas}</strong></div>
      </div>

      {loading && <div className={styles.emptyState}>Carregando escalas...</div>}
      {!loading && escalas.length === 0 && (
        <div className={styles.emptyState}>
          <CalendarDays size={28} />
          Nenhuma escala cadastrada
        </div>
      )}
      {!loading && escalas.length > 0 && (
        <div className={styles.cardsGrid}>
          {escalas.map((escala) => (
            <EscalaCard key={escala.id} escala={escala} onToggle={toggleStatus} />
          ))}
        </div>
      )}

      {modalOpen && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Nova Escala</h3>
                <p>Configure dias, folgas e horas previstas do modelo.</p>
              </div>
              <button className={styles.closeButton} type="button" onClick={closeModal} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <EscalaForm onSave={saveEscala} onCancel={closeModal} saving={saving} />
          </div>
        </div>
      )}
    </div>
  );
}
