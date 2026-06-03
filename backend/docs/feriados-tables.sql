USE MartreePonto;
GO

IF OBJECT_ID('dbo.app_feriados', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_feriados (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_feriados PRIMARY KEY,
    data_feriado DATE NOT NULL,
    descricao VARCHAR(150) NOT NULL,
    ativo BIT NOT NULL CONSTRAINT DF_app_feriados_ativo DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_feriados_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_app_feriados_data_feriado'
    AND object_id = OBJECT_ID('dbo.app_feriados')
)
BEGIN
  CREATE INDEX IX_app_feriados_data_feriado
    ON dbo.app_feriados (data_feriado)
    INCLUDE (ativo, descricao);
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT, UPDATE ON dbo.app_feriados TO ponto_api;
END;
GO
