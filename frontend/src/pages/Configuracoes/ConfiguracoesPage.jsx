import { apiFetch } from '../../utils/api';
import { Edit2, MapPin, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import styles from './ConfiguracoesPage.module.css';

const EMPTY_LOCAL_FORM = {
  nome: '',
  latitude: '',
  longitude: '',
  raioMetros: '100',
  ativo: true,
};

function parseMapCoordinates(value) {
  const text = String(value || '').trim();
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);

      if (
        Number.isFinite(latitude)
        && latitude >= -90
        && latitude <= 90
        && Number.isFinite(longitude)
        && longitude >= -180
        && longitude <= 180
      ) {
        return { latitude, longitude };
      }
    }
  }

  return null;
}

export default function ConfiguracoesPage() {
  const [locais, setLocais] = useState([]);
  const [localForm, setLocalForm] = useState(EMPTY_LOCAL_FORM);
  const [editingLocalId, setEditingLocalId] = useState(null);
  const [loadingLocais, setLoadingLocais] = useState(true);
  const [savingLocal, setSavingLocal] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [mapsLink, setMapsLink] = useState('');
  const [validacaoLocalizacaoAtiva, setValidacaoLocalizacaoAtiva] = useState(false);
  const [savingLocalizacaoConfig, setSavingLocalizacaoConfig] = useState(false);

  const loadConfiguracoes = useCallback(async () => {
    setLoadingLocais(true);

    try {
      const [configResponse, locaisResponse] = await Promise.all([
        apiFetch('/api/configuracoes/localizacao', {
          cache: 'no-store',
          credentials: 'include',
        }),
        apiFetch('/api/configuracoes/locais-permitidos', {
          cache: 'no-store',
          credentials: 'include',
        }),
      ]);
      const configData = await configResponse.json().catch(() => ({}));
      const locaisData = await locaisResponse.json().catch(() => ({}));

      if (!configResponse.ok) {
        throw new Error(configData.message || 'Nao foi possivel carregar a configuracao de localizacao.');
      }

      if (!locaisResponse.ok) {
        throw new Error(locaisData.message || 'Nao foi possivel carregar os locais permitidos.');
      }

      setValidacaoLocalizacaoAtiva(Boolean(configData.configuracao?.validacaoLocalizacaoAtiva));
      setLocais(locaisData.locais || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingLocais(false);
    }
  }, []);

  useEffect(() => {
    loadConfiguracoes();
  }, [loadConfiguracoes]);

  function updateLocalField(name, value) {
    setLocalForm((current) => ({ ...current, [name]: value }));
  }

  function resetLocalForm() {
    setLocalForm(EMPTY_LOCAL_FORM);
    setEditingLocalId(null);
    setMapsLink('');
  }

  function editLocal(local) {
    setEditingLocalId(local.id);
    setLocalForm({
      nome: local.nome || '',
      latitude: String(local.latitude ?? ''),
      longitude: String(local.longitude ?? ''),
      raioMetros: String(local.raioMetros || 100),
      ativo: Boolean(local.ativo),
    });
    setMapsLink('');
  }

  function applyMapsLink() {
    const coordinates = parseMapCoordinates(mapsLink);

    if (!coordinates) {
      setFeedback({ type: 'error', message: 'Nao foi possivel encontrar latitude e longitude nesse link do Maps.' });
      return;
    }

    setLocalForm((current) => ({
      ...current,
      latitude: coordinates.latitude.toFixed(7),
      longitude: coordinates.longitude.toFixed(7),
    }));
    setFeedback({ type: 'success', message: 'Coordenadas importadas do Maps.' });
  }

  function useCurrentLocationForLocal() {
    setFeedback(null);

    if (!navigator.geolocation) {
      setFeedback({ type: 'error', message: 'Este navegador nao permite capturar localizacao.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocalForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }));
        setFeedback({ type: 'success', message: 'Localizacao atual aplicada ao cadastro.' });
      },
      () => setFeedback({ type: 'error', message: 'Autorize a localizacao para usar sua posicao atual.' }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  async function saveLocal(event) {
    event.preventDefault();
    setFeedback(null);

    if (!localForm.nome.trim() || !String(localForm.latitude).trim() || !String(localForm.longitude).trim()) {
      setFeedback({ type: 'error', message: 'Informe nome, latitude e longitude do local permitido.' });
      return;
    }

    setSavingLocal(true);

    try {
      const response = await apiFetch(
        editingLocalId ? `/api/configuracoes/locais-permitidos/${editingLocalId}` : '/api/configuracoes/locais-permitidos',
        {
          method: editingLocalId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            nome: localForm.nome,
            latitude: Number(localForm.latitude),
            longitude: Number(localForm.longitude),
            raioMetros: Number(localForm.raioMetros || 100),
            ativo: localForm.ativo,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel salvar o local permitido.');
      }

      setFeedback({ type: 'success', message: data.message });
      resetLocalForm();
      await loadConfiguracoes();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSavingLocal(false);
    }
  }

  async function deleteLocal(local) {
    setFeedback(null);

    try {
      const response = await apiFetch(`/api/configuracoes/locais-permitidos/${local.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel excluir o local permitido.');
      }

      setFeedback({ type: 'success', message: data.message });
      if (editingLocalId === local.id) {
        resetLocalForm();
      }
      await loadConfiguracoes();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function toggleValidacaoLocalizacao(event) {
    const nextValue = event.target.checked;
    setValidacaoLocalizacaoAtiva(nextValue);
    setSavingLocalizacaoConfig(true);
    setFeedback(null);

    try {
      const response = await apiFetch('/api/configuracoes/localizacao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ validacaoLocalizacaoAtiva: nextValue }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Nao foi possivel salvar a configuracao de localizacao.');
      }

      setValidacaoLocalizacaoAtiva(Boolean(data.configuracao?.validacaoLocalizacaoAtiva));
      setFeedback({ type: 'success', message: data.message });
    } catch (error) {
      setValidacaoLocalizacaoAtiva(!nextValue);
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSavingLocalizacaoConfig(false);
    }
  }

  const localLatitude = Number(localForm.latitude);
  const localLongitude = Number(localForm.longitude);
  const hasLocalCoordinates = Number.isFinite(localLatitude)
    && localLatitude >= -90
    && localLatitude <= 90
    && Number.isFinite(localLongitude)
    && localLongitude >= -180
    && localLongitude <= 180;
  const mapPreviewSrc = hasLocalCoordinates
    ? `https://maps.google.com/maps?q=${localLatitude},${localLongitude}&z=17&output=embed`
    : '';
  const googleMapsUrl = hasLocalCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${localLatitude},${localLongitude}`
    : '';

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2>Configuracoes</h2>
            <p>Cadastre locais gerais autorizados para bater ponto.</p>
          </div>
        </div>

        {feedback && (
          <p className={feedback.type === 'success' ? styles.success : styles.error}>{feedback.message}</p>
        )}

        <div className={styles.locationConfig}>
          <div>
            <strong>Validacao de localizacao</strong>
            <span>{validacaoLocalizacaoAtiva ? 'Ativada: exige local permitido para bater ponto.' : 'Desativada: ponto liberado sem conferir locais permitidos.'}</span>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={validacaoLocalizacaoAtiva}
              disabled={savingLocalizacaoConfig}
              onChange={toggleValidacaoLocalizacao}
            />
            <span />
          </label>
        </div>

        <div className={styles.mapsTools}>
          <label>
            <span>Link do Google Maps</span>
            <input
              type="text"
              value={mapsLink}
              onChange={(event) => setMapsLink(event.target.value)}
              placeholder="Cole o link completo do Maps ou coordenadas: -23.0000000,-46.0000000"
            />
          </label>
          <button className={styles.btnSecondary} type="button" onClick={applyMapsLink}>Usar Link</button>
          <button className={styles.btnSecondary} type="button" onClick={useCurrentLocationForLocal}>
            <MapPin size={13} /> Minha Localizacao
          </button>
        </div>

        <form className={styles.localForm} onSubmit={saveLocal}>
          <label>
            <span>Nome</span>
            <input type="text" value={localForm.nome} onChange={(event) => updateLocalField('nome', event.target.value)} placeholder="Ex: Matriz" />
          </label>
          <label>
            <span>Latitude</span>
            <input type="number" step="any" value={localForm.latitude} onChange={(event) => updateLocalField('latitude', event.target.value)} placeholder="-23.0000000" />
          </label>
          <label>
            <span>Longitude</span>
            <input type="number" step="any" value={localForm.longitude} onChange={(event) => updateLocalField('longitude', event.target.value)} placeholder="-46.0000000" />
          </label>
          <label>
            <span>Raio metros</span>
            <input type="number" min="10" max="5000" value={localForm.raioMetros} onChange={(event) => updateLocalField('raioMetros', event.target.value)} />
          </label>
          <label className={styles.checkField}>
            <input type="checkbox" checked={localForm.ativo} onChange={(event) => updateLocalField('ativo', event.target.checked)} />
            <span>Ativo</span>
          </label>
          <div className={styles.formActions}>
            {editingLocalId && <button className={styles.btnSecondary} type="button" onClick={resetLocalForm}>Cancelar</button>}
            <button className={styles.btnPrimary} type="submit" disabled={savingLocal}>
              <MapPin size={13} /> {savingLocal ? 'Salvando...' : editingLocalId ? 'Salvar Local' : 'Adicionar Local'}
            </button>
          </div>
        </form>

        {hasLocalCoordinates && (
          <div className={styles.mapPreview}>
            <iframe title="Previa do local permitido" src={mapPreviewSrc} loading="lazy" />
            <a href={googleMapsUrl} target="_blank" rel="noreferrer">Abrir no Google Maps</a>
          </div>
        )}

        {loadingLocais && (
          <div className={styles.emptyState}>
            <MapPin size={28} opacity={0.3} />
            <span>Carregando locais permitidos...</span>
          </div>
        )}

        {!loadingLocais && locais.length === 0 && (
          <div className={styles.emptyState}>
            <MapPin size={28} opacity={0.3} />
            <span>Nenhum local permitido cadastrado</span>
          </div>
        )}

        {!loadingLocais && locais.length > 0 && (
          <div className={styles.localList}>
            {locais.map((local) => (
              <div key={local.id} className={styles.localRow}>
                <div>
                  <strong>{local.nome}</strong>
                  <span>{local.latitude}, {local.longitude} - raio {local.raioMetros}m</span>
                </div>
                <em className={local.ativo ? styles.statusActive : styles.statusInactive}>
                  {local.ativo ? 'Ativo' : 'Inativo'}
                </em>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => editLocal(local)}><Edit2 size={13} /> Editar</button>
                  <button type="button" onClick={() => deleteLocal(local)}><Trash2 size={13} /> Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
