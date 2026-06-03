# Backend Martree Ponto

API Express responsavel por autenticacao, JWT e conexao com PostgreSQL/Supabase.

## Comandos

```powershell
npm.cmd install
npm.cmd start
```

API local:

```text
http://localhost:3335
```

Tambem pode subir backend e frontend juntos pela raiz:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE"
npm.cmd run dev
```

## Arquivos Principais

```text
src/
|-- app.js
|-- server.js
|-- config/env.js
|-- db/postgres.js
|-- middlewares/
|   |-- authenticate.js
|   `-- errorHandler.js
|-- modules/auth/
|   |-- auth.repository.js
|   |-- auth.routes.js
|   `-- auth.service.js
`-- utils/identifier.js
```

## Rotas

- `GET /api/health`
- `GET /api/health/db`
- `POST /api/auth/login`
- `GET /api/auth/me`

## Banco

As variaveis ficam em `.env`. A tabela esperada e `"Usuarios"` no schema `public`.

Para criar a estrutura no Supabase:

```text
docs/supabase-schema.sql
```

O script cria `1001 / 123456` como funcionario e `1002 / 123456` como admin.
