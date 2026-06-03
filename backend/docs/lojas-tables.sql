IF OBJECT_ID('dbo.app_lojas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_lojas (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_lojas PRIMARY KEY,
    codigo INT NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    bairro VARCHAR(100) NULL,
    cnpj VARCHAR(20) NULL,
    ativo BIT NOT NULL CONSTRAINT DF_app_lojas_ativo DEFAULT 1,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_app_lojas_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,
    CONSTRAINT UQ_app_lojas_codigo UNIQUE (codigo)
  );
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT, UPDATE ON dbo.app_lojas TO ponto_api;
END;
GO
