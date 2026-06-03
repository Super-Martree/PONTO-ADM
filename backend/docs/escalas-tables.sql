IF OBJECT_ID('dbo.app_escala_dias', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_escala_dias (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_escala_dias PRIMARY KEY,
    escala_id INT NOT NULL,
    dia_semana TINYINT NOT NULL,
    meta_minutos INT NOT NULL CONSTRAINT DF_app_escala_dias_meta_minutos DEFAULT 0,
    ativo BIT NOT NULL CONSTRAINT DF_app_escala_dias_ativo DEFAULT 1,
    CONSTRAINT CK_app_escala_dias_dia_semana CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT CK_app_escala_dias_meta_minutos CHECK (meta_minutos >= 0),
    CONSTRAINT UQ_app_escala_dias_escala_dia UNIQUE (escala_id, dia_semana)
  );
END;
GO

IF OBJECT_ID('dbo.app_escalas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_escalas (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_escalas PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    tipo VARCHAR(30) NOT NULL CONSTRAINT DF_app_escalas_tipo DEFAULT 'fixa',
    ativo BIT NOT NULL CONSTRAINT DF_app_escalas_ativo DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_escalas_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL
  );
END;
GO

IF OBJECT_ID('dbo.app_escalas', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.app_escala_dias', 'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_app_escala_dias_app_escalas'
  )
BEGIN
  ALTER TABLE dbo.app_escala_dias
    ADD CONSTRAINT FK_app_escala_dias_app_escalas
    FOREIGN KEY (escala_id) REFERENCES dbo.app_escalas(id);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_app_escala_dias_escala'
    AND object_id = OBJECT_ID('dbo.app_escala_dias')
)
BEGIN
  CREATE INDEX IX_app_escala_dias_escala
    ON dbo.app_escala_dias (escala_id, dia_semana);
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT, UPDATE ON dbo.app_escalas TO ponto_api;
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.app_escala_dias TO ponto_api;
END;
GO
