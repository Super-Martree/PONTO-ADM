# Frontend Martree Ponto

Frontend React/Vite da aplicacao.

## Comandos

```powershell
npm.cmd install
npm.cmd start
```

App local:

```text
http://localhost:3000
```

Tambem pode subir frontend e backend juntos pela raiz:

```powershell
cd "C:\Users\Totti\Desktop\PONTO MARTREE"
npm.cmd run dev
```

Build:

```powershell
npm.cmd run build
```

## Estrutura

```text
src/
|-- main.jsx
|-- App.jsx
|-- styles/global.css
|-- components/
|   |-- Header/
|   |-- Layout/
|   `-- Sidebar/
`-- pages/
    |-- Apuracao/
    |-- Dashboard/
    |-- Funcionarios/
    |-- Login/
    |-- Ponto/
    |   |-- Ponto.jsx
    |   |-- Ponto.module.css
    |   `-- components/
    |       |-- RecordsTable.jsx
    |       `-- RecordsTable.module.css
    `-- Relatorios/
```

## Telas

Funcionario:

- `Ponto`: visual `E S E S`, com o primeiro `E` marcado apenas para demonstracao.
- `Registros`: indicadores visuais e tabela tipo Excel.
- A tabela de registros usa dados mockados em `pages/Ponto/components/RecordsTable.jsx`.

Admin:

- Dashboard
- Apuracao
- Funcionarios
- Relatorios
- Cadastros: Escalas, Lojas e Setores ainda em placeholder.

O proxy de `/api` aponta para `http://127.0.0.1:3335`.
