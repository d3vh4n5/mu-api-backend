-- Noticias del servidor (web /news, launcher y panel admin).
BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[News] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Title] NVARCHAR(120) NOT NULL,
    [Summary] NVARCHAR(300),
    [Content] NVARCHAR(max) NOT NULL,
    [Category] VARCHAR(20) NOT NULL CONSTRAINT [DF_News_Category] DEFAULT 'novedad',
    [ImageUrl] NVARCHAR(500),
    [Published] BIT NOT NULL CONSTRAINT [DF_News_Published] DEFAULT 0,
    [Pinned] BIT NOT NULL CONSTRAINT [DF_News_Pinned] DEFAULT 0,
    [PublishedAt] DATETIME,
    [CreatedAt] DATETIME NOT NULL CONSTRAINT [DF_News_CreatedAt] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME NOT NULL CONSTRAINT [DF_News_UpdatedAt] DEFAULT CURRENT_TIMESTAMP,
    [CreatedBy] VARCHAR(10) NOT NULL,
    [UpdatedBy] VARCHAR(10),
    CONSTRAINT [PK_News] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_News_Published_PublishedAt] ON [dbo].[News]([Published], [PublishedAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
