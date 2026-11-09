-- ctl1_code pasa de CHAR(1) a VARCHAR(2) para poder guardar el código de admin '32'.
-- VARCHAR (no CHAR) para que '0', '1' y '8' no queden con espacios de relleno.
BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[MEMB_INFO] ALTER COLUMN [ctl1_code] VARCHAR(2) NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
