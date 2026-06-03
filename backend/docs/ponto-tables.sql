IF OBJECT_ID('dbo.app_ponto_registros', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_ponto_registros (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_ponto_registros PRIMARY KEY,
    matricula VARCHAR(20) NOT NULL,
    data_ponto DATE NOT NULL,
    hora_ponto TIME(0) NOT NULL,
    data_hora DATETIME2(0) NOT NULL CONSTRAINT DF_app_ponto_registros_data_hora DEFAULT SYSDATETIME(),
    tipo VARCHAR(20) NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_ponto_registros_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT CK_app_ponto_registros_tipo CHECK (tipo IN ('entrada1', 'saida1', 'entrada2', 'saida2'))
  );
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
