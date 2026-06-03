import { useState } from 'react';

const styles = `
  .login-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Nunito', system-ui, sans-serif;
    background: radial-gradient(ellipse at 60% 40%, #d4f0e0 0%, #e8f8ef 40%, #f0faf5 100%);
    padding: 24px;
  }

  .login-card {
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 8px 48px rgba(30,100,60,0.13), 0 1.5px 6px rgba(0,0,0,0.06);
    display: flex;
    overflow: hidden;
    width: min(92vw, 520px);
    min-height: 300px;
    position: relative;
  }

  .login-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #1e7d3a 0%, #43c46e 100%);
  }

  .login-logo-panel {
    width: 190px;
    background: linear-gradient(160deg, #f6fdf8 0%, #e9f7ee 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #e4f0e8;
    padding: 24px 16px;
    flex-shrink: 0;
  }

  .login-logo-panel img {
    width: 135px;
    height: 135px;
    object-fit: contain;
    filter: drop-shadow(0 4px 16px rgba(30, 125, 58, 0.15));
  }

  .login-form-panel {
    flex: 1;
    padding: 36px 32px 32px;
  }

  .login-title {
    font-family: 'Montserrat', system-ui, sans-serif;
    font-weight: 800;
    font-size: 1.22rem;
    color: #1a3d28;
    margin-bottom: 22px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
  }

  .field-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #2d6a42;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .field-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .field-input {
    width: 100%;
    border: 1.5px solid #cde8d7;
    border-radius: 8px;
    padding: 10px 14px;
    font: inherit;
    font-size: 0.95rem;
    color: #1a3d28;
    background: #f8fdf9;
    outline: none;
  }

  .field-input:focus {
    border-color: #2db557;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(45,181,87,0.12);
  }

  .toggle-btn {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 700;
    color: #2db557;
    padding: 4px 2px;
  }

  .error-msg {
    font-size: 0.78rem;
    color: #c0392b;
    margin-top: -8px;
    margin-bottom: 6px;
    font-weight: 700;
  }

  .submit-btn {
    margin-top: 10px;
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 9px;
    background: linear-gradient(135deg, #22923f 0%, #1e7d3a 100%);
    color: #fff;
    font-family: 'Montserrat', system-ui, sans-serif;
    font-weight: 700;
    font-size: 0.93rem;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(30,125,58,0.28);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @media (max-width: 700px) {
    .login-card { flex-direction: column; width: min(94vw, 420px); }
    .login-logo-panel { width: 100%; min-height: 150px; border-right: 0; border-bottom: 1px solid #e4f0e8; }
    .login-form-panel { padding: 28px 22px 24px; }
  }
`;

export default function Login({ onLogin }) {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!matricula.trim()) return setError('Informe a matricula.');
    if (!senha.trim()) return setError('Informe a senha.');

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matricula, senha }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Credenciais invalidas.');
      }

      onLogin(data);
    } catch (err) {
      setError(err.message || 'Nao foi possivel entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <main className="login-root">
        <section className="login-card" aria-label="Tela de login da Martree">
          <aside className="login-logo-panel">
            <img src="/martri-mascote.png" alt="Martree" />
          </aside>

          <div className="login-form-panel">
            <h1 className="login-title">Comercial Martree</h1>

            <form onSubmit={handleSubmit} noValidate>
              <div className="field-group">
                <label className="field-label" htmlFor="matricula">Matricula</label>
                <div className="field-input-wrap">
                  <input
                    id="matricula"
                    className="field-input"
                    type="text"
                    placeholder="1001"
                    value={matricula}
                    onChange={(event) => setMatricula(event.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="senha">Senha</label>
                <div className="field-input-wrap">
                  <input
                    id="senha"
                    className="field-input"
                    type={showSenha ? 'text' : 'password'}
                    placeholder="******"
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    autoComplete="current-password"
                    style={{ paddingRight: '72px' }}
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowSenha((value) => !value)}>
                    {showSenha ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              {error && <p className="error-msg">{error}</p>}

              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar no Ponto Rapido'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
