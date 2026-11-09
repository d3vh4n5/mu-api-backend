BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[AdminAuditLog] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [CreatedAt] DATETIME NOT NULL CONSTRAINT [DF_AdminAuditLog_CreatedAt] DEFAULT CURRENT_TIMESTAMP,
    [AdminUser] VARCHAR(10) NOT NULL,
    [Action] VARCHAR(40) NOT NULL,
    [TargetType] VARCHAR(20) NOT NULL,
    [Target] VARCHAR(50) NOT NULL,
    [Reason] NVARCHAR(255),
    [Details] NVARCHAR(max),
    [Ip] VARCHAR(45),
    CONSTRAINT [PK_AdminAuditLog] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AdminAuditLog_CreatedAt] ON [dbo].[AdminAuditLog]([CreatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AdminAuditLog_Target] ON [dbo].[AdminAuditLog]([Target]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

