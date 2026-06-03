IF OBJECT_ID('dbo.app_ponto_ajustes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_ponto_ajustes (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_ponto_ajustes PRIMARY KEY,
    funcionario_id INT NOT NULL,
    matricula VARCHAR(20) NOT NULL,
    data_ponto DATE NOT NULL,
    entrada1 TIME(0) NULL,
    saida1 TIME(0) NULL,
    entrada2 TIME(0) NULL,
    saida2 TIME(0) NULL,
    tipo_ajuste VARCHAR(40) NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    observacao VARCHAR(500) NULL,
    meta_minutos_override INT NULL,
    ativo BIT NOT NULL CONSTRAINT DF_app_ponto_ajustes_ativo DEFAULT 1,
    created_by VARCHAR(120) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_ponto_ajustes_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NULL,
    CONSTRAINT CK_app_ponto_ajustes_tipo CHECK (
      tipo_ajuste IN (
        'ALTERAR_BATIDA',
        'JUSTIFICAR_FALTA',
        'ABONAR_DIA',
        'FALTA_DESCONTADA',
        'PAGO_EM_FOLHA',
        'MARCAR_FERIADO',
        'MARCAR_FOLGA',
        'MARCAR_TRABALHO'
      )
    )
  );
END;
GO

IF OBJECT_ID('dbo.app_ponto_ajustes', 'U') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_app_ponto_ajustes_tipo'
      AND parent_object_id = OBJECT_ID('dbo.app_ponto_ajustes')
  )
BEGIN
  ALTER TABLE dbo.app_ponto_ajustes DROP CONSTRAINT CK_app_ponto_ajustes_tipo;
END;
GO

IF OBJECT_ID('dbo.app_ponto_ajustes', 'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_app_ponto_ajustes_tipo'
      AND parent_object_id = OBJECT_ID('dbo.app_ponto_ajustes')
  )
BEGIN
  ALTER TABLE dbo.app_ponto_ajustes
    ADD CONSTRAINT CK_app_ponto_ajustes_tipo CHECK (
      tipo_ajuste IN (
        'ALTERAR_BATIDA',
        'JUSTIFICAR_FALTA',
        'ABONAR_DIA',
        'FALTA_DESCONTADA',
        'PAGO_EM_FOLHA',
        'MARCAR_FERIADO',
        'MARCAR_FOLGA',
        'MARCAR_TRABALHO'
      )
    );
END;
GO

IF OBJECT_ID('dbo.app_ponto_ajustes', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.app_ponto_ajustes', 'meta_minutos_override') IS NULL
BEGIN
  ALTER TABLE dbo.app_ponto_ajustes ADD meta_minutos_override INT NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_app_ponto_ajustes_funcionario_data'
    AND object_id = OBJECT_ID('dbo.app_ponto_ajustes')
)
BEGIN
  CREATE INDEX IX_app_ponto_ajustes_funcionario_data
    ON dbo.app_ponto_ajustes (funcionario_id, data_ponto, ativo)
    INCLUDE (entrada1, saida1, entrada2, saida2, tipo_ajuste, motivo, observacao, created_at);
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT, UPDATE ON dbo.app_ponto_ajustes TO ponto_api;
END;
GO
