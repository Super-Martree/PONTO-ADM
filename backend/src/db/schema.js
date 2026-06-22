const { getPool } = require("./postgres");

let escalasConfigColumnPromise = null;
let pontoLocationColumnsPromise = null;
let locaisPermitidosPromise = null;
let configuracoesPromise = null;
let escalasSemanaisPromise = null;

function resetPromiseOnFailure(promise, reset) {
  promise.catch(() => {
    reset();
  });
  return promise;
}

async function runEnsureEscalasConfigColumn() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.app_escalas', 'U') IS NOT NULL
      AND COL_LENGTH('dbo.app_escalas', 'configuracao_json') IS NULL
      ALTER TABLE dbo.app_escalas ADD configuracao_json varchar(max) NULL;
  `);
}

function ensureEscalasConfigColumn() {
  if (!escalasConfigColumnPromise) {
    escalasConfigColumnPromise = resetPromiseOnFailure(
      runEnsureEscalasConfigColumn(),
      () => {
        escalasConfigColumnPromise = null;
      }
    );
  }

  return escalasConfigColumnPromise;
}

async function runEnsurePontoLocationColumns() {
  const pool = await getPool();
  await pool.request().query(`
    IF COL_LENGTH('dbo.app_ponto_registros', 'latitude') IS NULL
      ALTER TABLE dbo.app_ponto_registros ADD latitude numeric(10, 7) NULL;

    IF COL_LENGTH('dbo.app_ponto_registros', 'longitude') IS NULL
      ALTER TABLE dbo.app_ponto_registros ADD longitude numeric(10, 7) NULL;

    IF COL_LENGTH('dbo.app_ponto_registros', 'accuracy_meters') IS NULL
      ALTER TABLE dbo.app_ponto_registros ADD accuracy_meters numeric(10, 2) NULL;

    IF COL_LENGTH('dbo.app_ponto_registros', 'location_captured_at') IS NULL
      ALTER TABLE dbo.app_ponto_registros ADD location_captured_at datetime2(0) NULL;
  `);
}

function ensurePontoLocationColumns() {
  if (!pontoLocationColumnsPromise) {
    pontoLocationColumnsPromise = resetPromiseOnFailure(
      runEnsurePontoLocationColumns(),
      () => {
        pontoLocationColumnsPromise = null;
      }
    );
  }

  return pontoLocationColumnsPromise;
}

async function runEnsureLocaisPermitidosSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.app_ponto_locais_permitidos', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.app_ponto_locais_permitidos (
        id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_ponto_locais_permitidos PRIMARY KEY,
        nome varchar(120) NOT NULL,
        latitude numeric(10, 7) NOT NULL,
        longitude numeric(10, 7) NOT NULL,
        raio_metros int NOT NULL CONSTRAINT DF_app_ponto_locais_permitidos_raio DEFAULT 100,
        ativo bit NOT NULL CONSTRAINT DF_app_ponto_locais_permitidos_ativo DEFAULT 1,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_app_ponto_locais_permitidos_created DEFAULT SYSDATETIME(),
        updated_at datetime2(0) NULL
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'ix_app_ponto_locais_permitidos_ativo'
        AND object_id = OBJECT_ID('dbo.app_ponto_locais_permitidos')
    )
      CREATE INDEX ix_app_ponto_locais_permitidos_ativo
        ON dbo.app_ponto_locais_permitidos (ativo);
  `);
}

function ensureLocaisPermitidosSchema() {
  if (!locaisPermitidosPromise) {
    locaisPermitidosPromise = resetPromiseOnFailure(
      runEnsureLocaisPermitidosSchema(),
      () => {
        locaisPermitidosPromise = null;
      }
    );
  }

  return locaisPermitidosPromise;
}

async function runEnsureConfiguracoesSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.app_configuracoes', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.app_configuracoes (
        chave varchar(80) NOT NULL CONSTRAINT PK_app_configuracoes PRIMARY KEY,
        valor varchar(max) NOT NULL,
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_app_configuracoes_updated DEFAULT SYSDATETIME()
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.app_configuracoes WHERE chave = 'validacao_localizacao_ativa')
      INSERT INTO dbo.app_configuracoes (chave, valor)
      VALUES ('validacao_localizacao_ativa', 'false');
  `);
}

function ensureConfiguracoesSchema() {
  if (!configuracoesPromise) {
    configuracoesPromise = resetPromiseOnFailure(
      runEnsureConfiguracoesSchema(),
      () => {
        configuracoesPromise = null;
      }
    );
  }

  return configuracoesPromise;
}

async function runEnsureEscalasSemanaisSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.app_funcionario_escalas_semanais', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.app_funcionario_escalas_semanais (
        id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_funcionario_escalas_semanais PRIMARY KEY,
        matricula varchar(30) NOT NULL,
        escala_id int NOT NULL,
        semana_inicio date NOT NULL,
        semana_fim date NOT NULL,
        motivo varchar(255) NULL,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_app_funcionario_escalas_semanais_created DEFAULT SYSDATETIME(),
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_app_funcionario_escalas_semanais_updated DEFAULT SYSDATETIME(),
        CONSTRAINT UX_app_funcionario_escalas_semanais_matricula_inicio UNIQUE (matricula, semana_inicio)
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'ix_app_funcionario_escalas_semanais_periodo'
        AND object_id = OBJECT_ID('dbo.app_funcionario_escalas_semanais')
    )
      CREATE INDEX ix_app_funcionario_escalas_semanais_periodo
        ON dbo.app_funcionario_escalas_semanais (matricula, semana_inicio, semana_fim);
  `);
}

function ensureEscalasSemanaisSchema() {
  if (!escalasSemanaisPromise) {
    escalasSemanaisPromise = resetPromiseOnFailure(
      runEnsureEscalasSemanaisSchema(),
      () => {
        escalasSemanaisPromise = null;
      }
    );
  }

  return escalasSemanaisPromise;
}

module.exports = {
  ensureConfiguracoesSchema,
  ensureEscalasConfigColumn,
  ensureEscalasSemanaisSchema,
  ensureLocaisPermitidosSchema,
  ensurePontoLocationColumns,
};
