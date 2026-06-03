# Martree Ponto

Sistema de ponto da Martree com frontend React/Vite e backend Express conectado ao PostgreSQL/Supabase.

## Visao Geral

O projeto esta separado em duas aplicacoes:

- `backend/`: API HTTP, autenticacao, JWT em cookie `HttpOnly`, regras de ponto, cadastros e conexao com Supabase PostgreSQL.
- `frontend/`: interface React para login, ponto do funcionario e painel administrativo.

Portas usadas:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3335`
- Banco: Supabase PostgreSQL

## Fluxo Atual

1. O usuario acessa `http://localhost:3000`.
2. O login envia `POST /api/auth/login`.
3. O Vite encaminha `/api` para `http://localhost:3335`.
4. O backend consulta a tabela `"Usuarios"` no Supabase.
5. Se a senha for valida, a API grava o JWT em cookie `HttpOnly` e retorna os dados do usuario.
6. O frontend salva apenas os dados do usuario em `sessionStorage`; o token nao fica acessivel ao JavaScript.
7. Perfil `admin` abre o painel administrativo.
8. Perfil `funcionario` abre a tela de ponto com abas `Ponto` e `Registros`.

## Estrutura

```text
PONTO MARTREE/
|-- README.md
|-- package.json
|-- backend/
|   |-- .env
|   |-- package.json
|   |-- docs/
|   |   |-- login-tables.sql
|   |   |-- ponto-tables.sql
|   |   |-- lojas-tables.sql
|   |   `-- funcionarios-tables.sql
|   `-- src/
|       |-- app.js
|       |-- server.js
|       |-- config/
|       |-- db/
|       |-- middlewares/
|       |-- modules/
|       |   |-- auth/
|       |   |-- funcionarios/
|       |   |-- lojas/
|       |   `-- ponto/
|       `-- utils/
`-- frontend/
    |-- package.json
    |-- vite.config.js
    |-- index.html
    |-- public/
    |   `-- martri-mascote.png
    `-- src/
        |-- App.jsx
        |-- main.jsx
        |-- components/
        |-- pages/
        |   |-- Apuracao/
        |   |-- Dashboard/
        |   |-- Funcionarios/
        |   |-- Login/
        |   |-- Lojas/
        |   |-- Ponto/
        |   |-- PontoDoMes/
        |   `-- Relatorios/
        `-- styles/
```

## Backend

Stack:

- Node.js
- Express
- PostgreSQL/Supabase via `pg`
- JWT via `jsonwebtoken`
- Senhas em texto puro ou bcrypt via `bcryptjs`
- CORS para o frontend local

Comandos:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE\backend"
npm.cmd install
npm.cmd start
```

## Rotas

### Auth

| Metodo | Rota | Descricao |
|---|---|---|
| `POST` | `/api/auth/login` | Autentica por matricula e senha |
| `GET` | `/api/auth/me` | Retorna usuario atualizado do banco usando o token |
| `POST` | `/api/auth/logout` | Limpa o cookie de autenticacao |

### Health

| Metodo | Rota | Descricao |
|---|---|---|
| `GET` | `/api/health` | Verifica se a API esta online |
| `GET` | `/api/health/db` | Verifica conexao com PostgreSQL/Supabase |

### Ponto

| Metodo | Rota | Descricao |
|---|---|---|
| `POST` | `/api/ponto/bater` | Registra batida real do usuario logado |
| `GET` | `/api/ponto/hoje` | Lista batidas reais do dia do usuario logado |
| `GET` | `/api/ponto/registros` | Lista registros do funcionario logado por periodo |
| `GET` | `/api/ponto/apuracao/hoje` | Dados reais do dia para a aba Registros/Apuracao do admin |
| `GET` | `/api/ponto/dashboard` | Indicadores reais do dashboard admin |

Periodos aceitos em `/api/ponto/registros`:

```text
periodo=geral
periodo=semana
periodo=mes
periodo=personalizado&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
```

### Lojas

| Metodo | Rota | Descricao |
|---|---|---|
| `GET` | `/api/lojas` | Lista lojas |
| `GET` | `/api/lojas?ativo=true` | Lista lojas filtrando por status |
| `GET` | `/api/lojas/next-codigo` | Retorna proximo codigo automatico |
| `GET` | `/api/lojas/:id` | Busca loja por ID |
| `POST` | `/api/lojas` | Cria loja |
| `PUT` | `/api/lojas/:id` | Atualiza loja |
| `PATCH` | `/api/lojas/:id/status` | Ativa ou inativa loja |

### Funcionarios

| Metodo | Rota | Descricao |
|---|---|---|
| `GET` | `/api/funcionarios` | Lista funcionarios |
| `GET` | `/api/funcionarios/next-matricula` | Retorna proxima matricula automatica |
| `POST` | `/api/funcionarios` | Cria funcionario |
| `PUT` | `/api/funcionarios/:id` | Atualiza funcionario |
| `PATCH` | `/api/funcionarios/:id/status` | Ativa ou inativa funcionario |

## Banco de Dados

Configuracao atual em `backend/.env`:

```text
DATABASE_URL=postgresql://postgres:[SENHA]@db.[PROJECT_REF].supabase.co:5432/postgres
DB_SSL=true
```

Script SQL para criar a estrutura no Supabase:

```text
backend/docs/supabase-schema.sql
```

Tabelas principais:

- `"Usuarios"`: login e cadastro inicial de funcionarios.
- `app_ponto_registros`: batidas reais de ponto.
- `app_lojas`: cadastro de lojas.

Observacoes:

- `supabase-schema.sql` cria `LojaId`, `SetorId`, `EscalaId` e `DataInicioPonto` em `"Usuarios"`.
- Setor e escala ainda nao possuem cadastro real.
- Funcionarios novos recebem senha inicial igual a matricula.

## Frontend

Stack:

- React
- Vite
- CSS Modules
- Lucide React para icones

Comandos:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE\frontend"
npm.cmd install
npm.cmd start
```

Build:

```powershell
npm.cmd run build
```

Proxy em `frontend/vite.config.js`:

```js
server: {
  proxy: {
    '/api': 'http://127.0.0.1:3335',
  },
}
```

## Telas

### Login

- Entrada por matricula e senha.
- Chama `/api/auth/login`.
- Redireciona por perfil.

### Funcionario

- Sidebar propria.
- Aba `Ponto`:
  - mostra logo, matricula, nome do funcionario, data e hora;
  - registra ponto real pelo usuario logado;
  - backend decide automaticamente `entrada1`, `saida1`, `entrada2`, `saida2`;
  - admin nao registra ponto.
- Aba `Registros`:
  - filtros `Geral`, `Semana`, `Mes` e `Personalizado`;
  - indicadores `Dias`, `Trabalhado`, `Saldo`, `Faltas`, `Pendencias`;
  - tabela com `Entrada`, `Saida`, `Entrada`, `Saida`, `Esperado`, `Trabalhado`, `Saldo`, `Status`.

### Admin

- Header global oculto nas abas admin.
- Sidebar com colapso/expansao.
- Dashboard:
  - indicadores reais de funcionarios, presentes, registros e pendencias;
  - resumo do dia;
  - ultimas ocorrencias.
- Ponto:
  - `Registros`: apuracao visual do dia com dados reais;
  - `Ponto do Mes`: tela mockada mensal, sem backend/SQL.
- Cadastros:
  - `Funcionarios`: CRUD inicial com matricula automatica, nome livre e loja real;
  - `Lojas`: CRUD completo com codigo automatico e CNPJ formatado;
  - `Escalas`: placeholder;
  - `Setores`: placeholder.
- Relatorios:
  - placeholder.

## Estado Atual

Funcionando:

- Separacao `backend/` e `frontend/`.
- API Express em `3335`.
- Frontend React em `3000`.
- Login com JWT em cookie `HttpOnly`.
- `/api/auth/me` busca dados atualizados no banco.
- Limite de tentativas no login.
- Ponto real persistido em Supabase PostgreSQL.
- Bloqueio de 5a batida no mesmo dia.
- Bloqueio de batida repetida em menos de 30 segundos.
- Admin bloqueado para bater ponto.
- Dashboard admin com dados reais do ponto.
- Apuracao/Registros admin refletindo ponto real do dia.
- Registros do funcionario com filtros por periodo.
- CRUD de lojas.
- Cadastro inicial de funcionarios.
- Ponto do Mes visual mockado.
- Build do frontend concluido com sucesso.

Pendente:

- Executar scripts SQL no banco quando o ambiente for novo.
- Implementar cadastro real de setores.
- Implementar cadastro real de escalas.
- Integrar setor/escala ao funcionario.
- Implementar apuracao real por periodo no admin.
- Implementar ajustes de ponto.
- Implementar relatorios reais.
- Trocar `JWT_SECRET` de desenvolvimento por segredo forte fora do repositorio antes de producao.

## Como Subir Tudo

Na raiz do projeto:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE"
npm.cmd install
npm.cmd run dev
```

Esse comando inicia backend e frontend juntos:

- Backend: `http://localhost:3335`
- Frontend: `http://localhost:3000`

Se precisar rodar separado:

```powershell
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend
```

Depois abra:

```text
http://localhost:3000
```

## Instalar Dependencias

Instalar somente o orquestrador da raiz:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE"
npm.cmd install
```

Instalar backend e frontend:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE"
npm.cmd run install:all
```

## Comandos Individuais

Frontend:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE\frontend"
npm.cmd start
```

Backend:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE\backend"
npm.cmd start
```

## Verificacao Rapida

```powershell
Invoke-RestMethod -Uri http://localhost:3335/api/health
Invoke-RestMethod -Uri http://localhost:3335/api/health/db
```

Teste de login depois de criar a tabela:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3335/api/auth/login `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"matricula":"1001","senha":"123456"}'
```
