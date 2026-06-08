IF OBJECT_ID('dbo.app_ponto_registros', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_ponto_registros (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_ponto_registros PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL,
    data_ponto DATE NOT NULL,
    hora_ponto TIME(0) NOT NULL,
    data_hora DATETIME2(0) NOT NULL CONSTRAINT DF_app_ponto_registros_data_hora DEFAULT SYSDATETIME(),
    tipo VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    accuracy_meters DECIMAL(10, 2) NULL,
    location_captured_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_ponto_registros_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT CK_app_ponto_registros_tipo CHECK (tipo IN ('entrada1', 'saida1', 'entrada2', 'saida2'))
  );
END;
GO

IF COL_LENGTH('dbo.app_ponto_registros', 'latitude') IS NULL
BEGIN
  ALTER TABLE dbo.app_ponto_registros
    ADD latitude DECIMAL(10, 7) NULL,
        longitude DECIMAL(10, 7) NULL,
        accuracy_meters DECIMAL(10, 2) NULL,
        location_captured_at DATETIME2(0) NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_app_ponto_registros_matricula_data'
    AND object_id = OBJECT_ID('dbo.app_ponto_registros')
)
BEGIN
  CREATE INDEX IX_app_ponto_registros_matricula_data
    ON dbo.app_ponto_registros (matricula, data_ponto)
    INCLUDE (hora_ponto, data_hora, tipo);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_app_ponto_registros_matricula_ultima'
    AND object_id = OBJECT_ID('dbo.app_ponto_registros')
)
BEGIN
  CREATE INDEX IX_app_ponto_registros_matricula_ultima
    ON dbo.app_ponto_registros (matricula, data_hora DESC);
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT ON dbo.app_ponto_registros TO ponto_api;
END;
GO

IF OBJECT_ID('dbo.app_ponto_locais_permitidos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_ponto_locais_permitidos (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_ponto_locais_permitidos PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    raio_metros INT NOT NULL CONSTRAINT DF_app_ponto_locais_raio DEFAULT 100,
    ativo BIT NOT NULL CONSTRAINT DF_app_ponto_locais_ativo DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_ponto_locais_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_app_ponto_locais_permitidos_ativo'
    AND object_id = OBJECT_ID('dbo.app_ponto_locais_permitidos')
)
BEGIN
  CREATE INDEX IX_app_ponto_locais_permitidos_ativo
    ON dbo.app_ponto_locais_permitidos (ativo);
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.app_ponto_locais_permitidos TO ponto_api;
END;
GO

IF OBJECT_ID('dbo.app_configuracoes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_configuracoes (
    chave VARCHAR(80) NOT NULL CONSTRAINT PK_app_configuracoes PRIMARY KEY,
    valor VARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_configuracoes_updated_at DEFAULT SYSDATETIME()
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM dbo.app_configuracoes
  WHERE chave = 'validacao_localizacao_ativa'
)
BEGIN
  INSERT INTO dbo.app_configuracoes (chave, valor)
  VALUES ('validacao_localizacao_ativa', 'false');
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT, UPDATE ON dbo.app_configuracoes TO ponto_api;
END;
GO
