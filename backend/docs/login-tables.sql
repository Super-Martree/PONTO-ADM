USE MartreePonto;
GO

IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Usuarios (
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Usuarios PRIMARY KEY,
    Matricula varchar(30) NOT NULL CONSTRAINT UQ_Usuarios_Matricula UNIQUE,
    Senha varchar(255) NOT NULL,
    Nome varchar(120) NOT NULL,
    Perfil varchar(30) NOT NULL,
    Ativo bit NOT NULL CONSTRAINT DF_Usuarios_Ativo DEFAULT 1,
    CriadoEm datetime2(0) NOT NULL CONSTRAINT DF_Usuarios_CriadoEm DEFAULT SYSDATETIME(),
    AtualizadoEm datetime2(0) NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Matricula = '1001')
BEGIN
  INSERT INTO dbo.Usuarios (Matricula, Senha, Nome, Perfil, Ativo)
  VALUES ('1001', '123456', 'Funcionario', 'funcionario', 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Matricula = '1002')
BEGIN
  INSERT INTO dbo.Usuarios (Matricula, Senha, Nome, Perfil, Ativo)
  VALUES ('1002', '123456', 'Administrador', 'admin', 1);
END;
GO

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'ponto_api')
BEGIN
  GRANT SELECT ON dbo.Usuarios TO ponto_api;
END;
GO
