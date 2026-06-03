USE MartreePonto;
GO

IF COL_LENGTH('dbo.Usuarios', 'LojaId') IS NULL
BEGIN
  ALTER TABLE dbo.Usuarios ADD LojaId INT NULL;
END;
GO

IF COL_LENGTH('dbo.Usuarios', 'SetorId') IS NULL
BEGIN
  ALTER TABLE dbo.Usuarios ADD SetorId INT NULL;
END;
GO

IF COL_LENGTH('dbo.Usuarios', 'EscalaId') IS NULL
BEGIN
  ALTER TABLE dbo.Usuarios ADD EscalaId INT NULL;
END;
GO

IF COL_LENGTH('dbo.Usuarios', 'DataInicioPonto') IS NULL
BEGIN
  ALTER TABLE dbo.Usuarios ADD DataInicioPonto DATE NULL;
END;
GO

IF OBJECT_ID('dbo.app_lojas', 'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Usuarios_LojaId_app_lojas'
  )
BEGIN
  ALTER TABLE dbo.Usuarios
    ADD CONSTRAINT FK_Usuarios_LojaId_app_lojas
    FOREIGN KEY (LojaId) REFERENCES dbo.app_lojas(id);
END;
GO

IF OBJECT_ID('dbo.app_escalas', 'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_Usuarios_EscalaId_app_escalas'
  )
BEGIN
  ALTER TABLE dbo.Usuarios
    ADD CONSTRAINT FK_Usuarios_EscalaId_app_escalas
    FOREIGN KEY (EscalaId) REFERENCES dbo.app_escalas(id);
END;
GO

IF USER_ID('ponto_api') IS NOT NULL
BEGIN
  GRANT SELECT, INSERT, UPDATE ON dbo.Usuarios TO ponto_api;
END;
GO
