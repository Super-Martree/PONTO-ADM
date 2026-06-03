import { apiFetch } from '../../utils/api';
import { Edit2, Plus, Power, Store } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import styles from './LojasPage.module.css';

const EMPTY_FORM = {
  codigo: '',
  nome: '',
  cidade: '',
  bairro: '',
  cnpj: '',
  ativo: true,
};

function formatCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function LojasPage() {
  const [lojas, setLojas] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadLojas = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiFetch('/api/lojas', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel carregar as lojas.');
      }

      setLojas(data.lojas || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLojas();
  }, [loadLojas]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(false);
  }

  async function openNewLoja() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFeedback(null);
    setModalOpen(true);

    try {
      const response = await apiFetch('/api/lojas/next-codigo', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel gerar o codigo.');
      }

      setForm((current) => ({ ...current, codigo: String(data.codigo || '') }));
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  function editLoja(loja) {
    setEditingId(loja.id);
    setForm({
      codigo: String(loja.codigo || ''),
      nome: loja.nome || '',
      cidade: loja.cidade || '',
      bairro: loja.bairro || '',
      cnpj: formatCnpj(loja.cnpj || ''),
      ativo: Boolean(loja.ativo),
    });
    setFeedback(null);
    setModalOpen(true);
  }

  async function saveLoja(event) {
    event.preventDefault();
    setFeedback(null);

    if (!String(form.codigo).trim() || !form.nome.trim() || !form.cidade.trim()) {
      setFeedback({ type: 'error', message: 'Informe codigo, nome e cidade.' });
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch(editingId ? `/api/lojas/${editingId}` : '/api/lojas', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          codigo: Number(form.codigo),
          nome: form.nome,
          cidade: form.cidade,
          bairro: form.bairro,
          cnpj: form.cnpj,
          ativo: form.ativo,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel salvar a loja.');
      }

      setFeedback({ type: 'success', message: data.message });
      resetForm();
      await loadLojas();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(loja) {
    setFeedback(null);

    try {
      const response = await apiFetch(`/api/lojas/${loja.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ativo: !loja.ativo }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel alterar o status.');
      }

      setFeedback({ type: 'success', message: data.message });
      await loadLojas();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageActions}>
          <button className={styles.btnPrimary} type="button" onClick={openNewLoja}>
            <Plus size={13} /> Nova Loja
          </button>
        </div>
      </div>

      {feedback && (
        <p className={feedback.type === 'success' ? styles.success : styles.error}>{feedback.message}</p>
      )}

      <div className={styles.card}>
        <div className={styles.tableHeader}>
          <span>Codigo</span>
          <span>Nome</span>
          <span>Cidade</span>
          <span>Bairro</span>
          <span>Status</span>
          <span>Acoes</span>
        </div>

        {loading && (
          <div className={styles.emptyState}>
            <Store size={28} opacity={0.3} />
            <span>Carregando lojas...</span>
          </div>
        )}

        {!loading && lojas.length === 0 && (
          <div className={styles.emptyState}>
            <Store size={28} opacity={0.3} />
            <span>Nenhuma loja cadastrada</span>
          </div>
        )}

        {!loading && lojas.length > 0 && (
          <div className={styles.tableBody}>
            {lojas.map((loja) => (
              <div key={loja.id} className={styles.tableRow}>
                <span>{loja.codigo}</span>
                <strong>{loja.nome}</strong>
                <span>{loja.cidade}</span>
                <span>{loja.bairro || '-'}</span>
                <span className={loja.ativo ? styles.statusActive : styles.statusInactive}>
                  {loja.ativo ? 'Ativa' : 'Inativa'}
                </span>
                <span className={styles.rowActions}>
                  <button type="button" onClick={() => editLoja(loja)}><Edit2 size={13} /> Editar</button>
                  <button type="button" onClick={() => toggleStatus(loja)}>
                    <Power size={13} /> {loja.ativo ? 'Inativar' : 'Ativar'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} role="presentation">
          <form className={styles.modalCard} onSubmit={saveLoja}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{editingId ? 'Editar Loja' : 'Nova Loja'}</h3>
                <p>Preencha os dados cadastrais da loja.</p>
              </div>
              <button className={styles.closeBtn} type="button" onClick={resetForm}>×</button>
            </div>

            <div className={styles.formGrid}>
              <label>
                <span>Codigo</span>
                <input
                  type="number"
                  value={form.codigo}
                  onChange={(event) => updateField('codigo', event.target.value)}
                  readOnly={!editingId}
                />
              </label>
              <label>
                <span>Nome</span>
                <input type="text" value={form.nome} onChange={(event) => updateField('nome', event.target.value)} />
              </label>
              <label>
                <span>Cidade</span>
                <input type="text" value={form.cidade} onChange={(event) => updateField('cidade', event.target.value)} />
              </label>
              <label className={styles.bairroField}>
                <span>Bairro</span>
                <input
                  className={styles.bairroInput}
                  type="text"
                  value={form.bairro}
                  onChange={(event) => updateField('bairro', event.target.value)}
                />
              </label>
              <label className={styles.cnpjField}>
                <span>CNPJ</span>
                <input
                  className={styles.cnpjInput}
                  type="text"
                  value={form.cnpj}
                  onChange={(event) => updateField('cnpj', formatCnpj(event.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </label>
              <label className={styles.checkField}>
                <input type="checkbox" checked={form.ativo} onChange={(event) => updateField('ativo', event.target.checked)} />
                <span>Loja ativa</span>
              </label>
            </div>

            <div className={styles.formActions}>
              <button className={styles.btnSecondary} type="button" onClick={resetForm}>Cancelar</button>
              <button className={styles.btnPrimary} type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Salvar Loja'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
