import { apiFetch, clearAuthToken, setAuthToken } from './utils/api';
import { lazy, Suspense, useEffect, useState } from 'react';
import './styles/global.css';
import Layout from './components/Layout/Layout';
import ApiStatusModal from './components/ApiStatusModal';
import { installApiMonitor } from './utils/apiMonitor';

installApiMonitor();

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Apuracao = lazy(() => import('./pages/Apuracao'));
const ConfiguracoesPage = lazy(() => import('./pages/Configuracoes'));
const EscalasModelosPage = lazy(() => import('./pages/EscalasModelos'));
const EscalasFuncionariosPage = lazy(() => import('./pages/EscalasFuncionarios'));
const FeriadosPage = lazy(() => import('./pages/Feriados'));
const Funcionarios = lazy(() => import('./pages/Funcionarios'));
const LojasPage = lazy(() => import('./pages/Lojas'));
const BancoHorasPage = lazy(() => import('./pages/BancoHoras'));
const PontoDoMesPage = lazy(() => import('./pages/PontoDoMes'));
const ResumoFuncionariosPage = lazy(() => import('./pages/ResumoFuncionarios'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Ponto = lazy(() => import('./pages/Ponto'));
const TratativasAjustarPontoPage = lazy(() => import('./pages/TratativasAjustarPonto'));
const TratativasPendentesPage = lazy(() => import('./pages/TratativasPendentes'));
const TratativasHistoricoPage = lazy(() => import('./pages/TratativasHistorico'));

function readSession() {
  const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user');
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

  if (!rawUser || !token) return null;

  try {
    return { user: JSON.parse(rawUser), verified: false };
  } catch {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    clearAuthToken();
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
  sessionStorage.removeItem('user');
}

function clearUser() {
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
}

function renderPage(page, props = {}) {
  switch (page) {
    case 'dashboard':
      return <Dashboard onNavigate={props.onNavigate} />;
    case 'apuracao':
      return <Apuracao initialState={props.pageState} />;
    case 'resumo-funcionarios':
      return <ResumoFuncionariosPage />;
    case 'banco-horas':
      return <BancoHorasPage />;
    case 'ponto-do-mes':
      return <PontoDoMesPage />;
    case 'relatorios':
      return <Relatorios />;
    case 'configuracoes':
      return <ConfiguracoesPage />;
    case 'funcionarios':
      return <Funcionarios />;
    case 'escalas':
    case 'escalas-modelos':
      return <EscalasModelosPage />;
    case 'escalas-funcionarios':
      return <EscalasFuncionariosPage />;
    case 'feriados':
      return <FeriadosPage />;
    case 'lojas':
      return <LojasPage />;
    case 'tratativas-ajustar-ponto':
      return <TratativasAjustarPontoPage />;
    case 'tratativas-pendentes':
      return <TratativasPendentesPage />;
    case 'tratativas-historico':
      return <TratativasHistoricoPage />;
    default:
      return <Dashboard />;
  }
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [activePage, setActivePage] = useState('dashboard');
  const [pageState, setPageState] = useState({});
  const [checkingSession, setCheckingSession] = useState(Boolean(session));
  const path = window.location.pathname;

  useEffect(() => {
    if (!session && path !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, [path, session]);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (!session || session.verified) {
        setCheckingSession(false);
        return;
      }

      try {
        const response = await apiFetch('/api/auth/me', { credentials: 'include' });

        if (!response.ok) {
          throw new Error('Sessao expirada.');
        }

        const data = await response.json();

        if (!cancelled) {
          saveUser(data.user);
          setSession({ user: data.user, verified: true });
        }
      } catch {
        clearUser();
        clearAuthToken();

        if (!cancelled) {
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [session]);

  function handleLogin(data) {
    setAuthToken(data.token);
    saveUser(data.user);
    setSession({ user: data.user, verified: true });
    window.history.replaceState(null, '', data.user.role === 'admin' ? '/admin' : '/ponto');
  }

  function handleLogout() {
    apiFetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    clearUser();
    clearAuthToken();
    setSession(null);
    window.history.replaceState(null, '', '/');
  }

  function handleNavigate(page, nextState = {}) {
    setPageState(nextState);
    setActivePage(page);
  }

  if (checkingSession) {
    return null;
  }

  if (!session) {
    return (
      <>
        <Suspense fallback={null}>
          <Login onLogin={handleLogin} />
        </Suspense>
        <ApiStatusModal />
      </>
    );
  }

  if (session.user.role !== 'admin') {
    return (
      <>
        <Suspense fallback={null}>
          <Ponto user={session.user} onLogout={handleLogout} />
        </Suspense>
        <ApiStatusModal />
      </>
    );
  }

  return (
    <>
      <Layout
        activePage={activePage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={session.user}
      >
        <Suspense fallback={null}>
          {renderPage(activePage, { onNavigate: handleNavigate, pageState })}
        </Suspense>
      </Layout>
      <ApiStatusModal />
    </>
  );
}
