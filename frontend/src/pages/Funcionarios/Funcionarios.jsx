import { apiFetch } from '../../utils/api';
import { AlertCircle, ChevronDown, Edit2, Filter, Plus, Power, Search, Store, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDateBr, parseDateBrInput, todayBrDateInput, toBrDateInput } from '../../utils/date';
import styles from './Funcionarios.module.css';

const EMPTY_FORM = {
  matricula: '',
  nome: '',
  senha: '',
  lojaId: '',
  inicioPonto: '',
  ativo: true,
};

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativos', label: 'Ativos' },
  { value: 'inativos', label: 'Inativos' },
];

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getInitials(nome) {
  const parts = String(nome || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '--';
}

function getAuditFieldLabel(campo) {
  return campo;
}

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [auditRecords, setAuditRecords] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [lojaFilter, setLojaFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');

  const loadFuncionarios = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiFetch('/api/funcionarios', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar funcionarios.');
      }

      setFuncionarios(data.funcionarios || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLojas = useCallback(async () => {
    try {
      const response = await apiFetch('/api/lojas?ativo=true', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar lojas.');
      }

      setLojas(data.lojas || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }, []);

  useEffect(() => {
    loadFuncionarios();
    loadLojas();
  }, [loadFuncionarios, loadLojas]);

  const lojasOptions = useMemo(() => {
    const map = new Map();

    funcionarios.forEach((funcionario) => {
      if (funcionario.lojaId && funcionario.lojaNome) {
        map.set(String(funcionario.lojaId), funcionario.lojaNome);
      }
    });

    lojas.forEach((loja) => {
      map.set(String(loja.id), loja.nome);
    });

    return [...map.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [funcionarios, lojas]);

  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter((funcionario) => {
      const funcionarioMatch = !selectedFuncionarioId || String(funcionario.id) === String(selectedFuncionarioId);
      const statusMatch =
        statusFilter === 'todos' ||
        (statusFilter === 'ativos' && funcionario.ativo) ||
        (statusFilter === 'inativos' && !funcionario.ativo);
      const lojaMatch = lojaFilter === 'todas' || String(funcionario.lojaId || '') === lojaFilter;

      return funcionarioMatch && statusMatch && lojaMatch;
    });
  }, [funcionarios, lojaFilter, selectedFuncionarioId, statusFilter]);
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

  const resumo = useMemo(() => ({
    ativos: funcionarios.filter((funcionario) => funcionario.ativo).length,
    inativos: funcionarios.filter((funcionario) => !funcionario.ativo).length,
    lojas: new Set(funcionarios.filter((funcionario) => funcionario.lojaId).map((funcionario) => funcionario.lojaId)).size,
  }), [funcionarios]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectFuncionario(funcionarioId) {
    setSelectedFuncionarioId(funcionarioId);
    setEmployeePickerOpen(false);
    setEmployeeSearch('');
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(false);
    setInfoModalOpen(false);
    setAuditRecords([]);
    setAuditError('');
  }

  async function openNewFuncionario() {
    setForm({ ...EMPTY_FORM, inicioPonto: todayBrDateInput() });
    setEditingId(null);
    setFeedback(null);
    setModalOpen(true);

    try {
      const response = await apiFetch('/api/funcionarios/next-matricula', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel gerar matricula.');
      }

      setForm((current) => ({
        ...current,
        matricula: data.matricula || '',
        inicioPonto: current.inicioPonto || todayBrDateInput(),
      }));
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  function editFuncionario(funcionario) {
    setEditingId(funcionario.id);
    setForm({
      matricula: funcionario.matricula || '',
      nome: funcionario.nome || '',
      senha: '',
      lojaId: funcionario.lojaId ? String(funcionario.lojaId) : '',
      inicioPonto: toBrDateInput(funcionario.dataInicioPonto) || todayBrDateInput(),
      ativo: Boolean(funcionario.ativo),
    });
    setFeedback(null);
    setModalOpen(true);
    setInfoModalOpen(false);
  }

  async function saveFuncionario(event) {
    event.preventDefault();
    setFeedback(null);

    if (!form.nome.trim()) {
      setFeedback({ type: 'error', message: 'Informe o nome do funcionario.' });
      return;
    }

    if (!form.lojaId) {
      setFeedback({ type: 'error', message: 'Selecione uma loja para o funcionario.' });
      return;
    }

    if (form.senha && form.senha.length > 128) {
      setFeedback({ type: 'error', message: 'Senha deve ter no maximo 128 caracteres.' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        nome: form.nome,
        lojaId: form.lojaId || null,
        setorId: null,
        ativo: form.ativo,
      };

      if (form.senha) {
        payload.senha = form.senha;
      }

      const dataInicioPonto = parseDateBrInput(form.inicioPonto);
      if (dataInicioPonto) {
        payload.dataInicioPonto = dataInicioPonto;
      }

      const response = await apiFetch(editingId ? `/api/funcionarios/${editingId}` : '/api/funcionarios', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel salvar funcionario.');
      }

      setFeedback({ type: 'success', message: data.message });
      resetForm();
      await loadFuncionarios();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(funcionario) {
    setFeedback(null);

    try {
      const response = await apiFetch(`/api/funcionarios/${funcionario.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo: !funcionario.ativo }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel alterar status.');
      }

      setFeedback({ type: 'success', message: data.message });
      await loadFuncionarios();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function openAuditModal() {
    if (!editingId) return;

    setInfoModalOpen(true);
    setAuditLoading(true);
    setAuditError('');

    try {
      const response = await apiFetch(`/api/funcionarios/${editingId}/auditoria`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar os registros de alteracao.');
      }

      const hiddenFields = new Set(['Inicio desta escala', 'Alteracao de Escala', 'Escala Alterada']);
      setAuditRecords((data.auditoria || []).filter((record) => !hiddenFields.has(record.campo)));
    } catch (error) {
      setAuditError(error.message || 'Nao foi possivel carregar os registros de alteracao.');
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2>Funcionarios</h2>
          <p>Cadastre, filtre e mantenha o status dos colaboradores.</p>
        </div>
        <div className={styles.pageActions}>
          <button className={styles.btnPrimary} type="button" onClick={openNewFuncionario}>
            <Plus size={13} /> Novo Funcionario
          </button>
        </div>
      </div>

      {feedback && (
        <p className={feedback.type === 'success' ? styles.success : styles.error}>{feedback.message}</p>
      )}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}><Users size={17} /></span>
          <div>
            <small>Ativos</small>
            <strong>{resumo.ativos}</strong>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}><Power size={17} /></span>
          <div>
            <small>Inativos</small>
            <strong>{resumo.inativos}</strong>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}><Store size={17} /></span>
          <div>
            <small>Lojas com equipe</small>
            <strong>{resumo.lojas}</strong>
          </div>
        </div>
      </div>

      <div className={styles.card}>
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
                    className={`${styles.employeeOption} ${!selectedFuncionarioId ? styles.employeeOptionActive : ''}`}
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
                    const active = String(funcionario.id) === String(selectedFuncionarioId);

                    return (
                      <button
                        key={funcionario.id}
                        className={`${styles.employeeOption} ${active ? styles.employeeOptionActive : ''}`}
                        type="button"
                        onClick={() => selectFuncionario(String(funcionario.id))}
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
              <option value="todas">Todas as lojas</option>
              {lojasOptions.map((loja) => (
                <option key={loja.id} value={loja.id}>{loja.nome}</option>
              ))}
            </select>
          </label>

          <label className={styles.selectBox}>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <span className={styles.resultCount}>
            {filteredFuncionarios.length} de {funcionarios.length}
          </span>
        </div>

        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Matricula</th>
                <th>Funcionario</th>
                <th>Loja</th>
                <th>Inicio Ponto</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    <Users size={24} opacity={0.3} />
                    Carregando funcionarios...
                  </td>
                </tr>
              )}

              {!loading && funcionarios.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    <Users size={24} opacity={0.3} />
                    Nenhum funcionario cadastrado
                  </td>
                </tr>
              )}

              {!loading && funcionarios.length > 0 && filteredFuncionarios.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    <Search size={24} opacity={0.3} />
                    Nenhum resultado encontrado
                  </td>
                </tr>
              )}

              {!loading && filteredFuncionarios.map((funcionario) => (
                <tr key={funcionario.id}>
                  <td className={styles.matriculaCell}>#{funcionario.matricula}</td>
                  <td>
                    <div className={styles.employeeCell}>
                      <span className={styles.avatar}>{getInitials(funcionario.nome)}</span>
                      <strong>{funcionario.nome}</strong>
                    </div>
                  </td>
                  <td>{funcionario.lojaNome || '-'}</td>
                  <td>{formatDateBr(funcionario.dataInicioPonto) || '-'}</td>
                  <td>
                    <span className={funcionario.ativo ? styles.statusActive : styles.statusInactive}>
                      {funcionario.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => editFuncionario(funcionario)}><Edit2 size={13} /> Editar</button>
                      <button type="button" onClick={() => toggleStatus(funcionario)}>
                        <Power size={13} /> {funcionario.ativo ? 'Inativar' : 'Ativar'}
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
          <form className={styles.modalCard} onSubmit={saveFuncionario}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{editingId ? 'Editar Funcionario' : 'Novo Funcionario'}</h3>
                <p>{editingId ? 'Preencha a senha somente se desejar alterar.' : 'Se a senha ficar em branco, sera usada a matricula.'}</p>
              </div>
              <button className={styles.closeBtn} type="button" onClick={resetForm} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            {editingId && (
              <button className={styles.infoNotice} type="button" onClick={openAuditModal}>
                <AlertCircle size={16} />
                <span>Clique para ver o historico linha por linha: campo alterado, antes, depois, responsavel e data.</span>
              </button>
            )}

            <div className={styles.formGrid}>
              <label>
                <span>Matricula</span>
                <input type="text" value={form.matricula} readOnly />
              </label>
              <label className={styles.nameField}>
                <span>Nome</span>
                <input type="text" value={form.nome} onChange={(event) => updateField('nome', event.target.value)} />
              </label>
              <label>
                <span>{editingId ? 'Nova senha' : 'Senha'}</span>
                <input
                  type="password"
                  value={form.senha}
                  onChange={(event) => updateField('senha', event.target.value)}
                  placeholder={editingId ? 'Manter atual' : 'Padrao: matricula'}
                  maxLength={128}
                />
              </label>
              <label>
                <span>Loja</span>
                <select required value={form.lojaId} onChange={(event) => updateField('lojaId', event.target.value)}>
                  <option value="">Selecione</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>{loja.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Inicio do ponto</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  value={form.inicioPonto}
                  onChange={(event) => updateField('inicioPonto', event.target.value)}
                />
              </label>
              <label className={styles.checkField}>
                <input type="checkbox" checked={form.ativo} onChange={(event) => updateField('ativo', event.target.checked)} />
                <span>Funcionario ativo</span>
              </label>
            </div>

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} type="button" onClick={resetForm}>Cancelar</button>
              <button className={styles.btnPrimary} type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Salvar Funcionario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {infoModalOpen && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.infoModalCard} role="dialog" aria-modal="true" aria-label="Registros da edicao">
            <div className={styles.modalHeader}>
              <div>
                <h3>Historico de alteracoes</h3>
                <p>Alteracoes salvas no cadastro deste funcionario.</p>
              </div>
              <button className={styles.closeBtn} type="button" onClick={() => setInfoModalOpen(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            {auditLoading && <div className={styles.auditEmpty}>Carregando alteracoes...</div>}
            {!auditLoading && auditError && <div className={styles.auditEmpty}>{auditError}</div>}
            {!auditLoading && !auditError && auditRecords.length === 0 && (
              <div className={styles.auditEmpty}>Nenhuma alteracao registrada ainda.</div>
            )}
            {!auditLoading && !auditError && auditRecords.length > 0 && (
              <div className={styles.auditList}>
                {auditRecords.map((record) => (
                  <div key={record.id} className={styles.auditItem}>
                    <div className={styles.auditItemHeader}>
                      <strong>{getAuditFieldLabel(record.campo)}</strong>
                      <span>{record.alteradoEm}</span>
                    </div>
                    <div className={styles.auditValues}>
                      <span>ANTES: <strong>{String(record.valorAnterior || '-').toUpperCase()}</strong></span>
                      <span>DEPOIS: <strong>{String(record.valorNovo || '-').toUpperCase()}</strong></span>
                    </div>
                    <small>Alterado por {record.alteradoPorNome || record.alteradoPorMatricula || '-'}</small>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.formActions}>
              <button className={styles.btnPrimary} type="button" onClick={() => setInfoModalOpen(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
