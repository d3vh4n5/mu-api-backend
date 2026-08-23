BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[AccountCharacter] (
    [Number] INT NOT NULL IDENTITY(1,1),
    [Id] VARCHAR(10) NOT NULL,
    [GameID1] VARCHAR(10),
    [GameID2] VARCHAR(10),
    [GameID3] VARCHAR(10),
    [GameID4] VARCHAR(10),
    [GameID5] VARCHAR(10),
    [GameIDC] VARCHAR(10),
    [MoveCnt] TINYINT CONSTRAINT [DF__AccountCh__MoveC__7A3223E8] DEFAULT 0,
    [ExtClass] INT NOT NULL CONSTRAINT [df_AccountCharacter_ExtClass] DEFAULT 2,
    [Locked] INT NOT NULL CONSTRAINT [DF_AccountCharacter_Locked] DEFAULT 0,
    [Password] VARCHAR(50),
    CONSTRAINT [PK_AccountCharacter] PRIMARY KEY NONCLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Character] (
    [AccountID] VARCHAR(10) NOT NULL,
    [Name] VARCHAR(10) NOT NULL,
    [cLevel] INT CONSTRAINT [DF_Character_cLevel] DEFAULT 1,
    [LevelUpPoint] INT CONSTRAINT [DF_Character_LevelUpPoint] DEFAULT 0,
    [Class] TINYINT,
    [Experience] INT CONSTRAINT [DF_Character_Experience] DEFAULT 0,
    [Strength] INT,
    [Dexterity] INT,
    [Vitality] INT,
    [Energy] INT,
    [Leadership] INT CONSTRAINT [DF__Character__Leade__7A672E12] DEFAULT 0,
    [Inventory] VARBINARY(1728),
    [MagicList] VARBINARY(180),
    [Money] INT CONSTRAINT [DF_Character_Money] DEFAULT 0,
    [Life] REAL,
    [MaxLife] REAL,
    [Mana] REAL,
    [MaxMana] REAL,
    [BP] REAL,
    [MaxBP] REAL,
    [MapNumber] SMALLINT,
    [MapPosX] SMALLINT,
    [MapPosY] SMALLINT,
    [MapDir] TINYINT CONSTRAINT [DF_Character_MapDir] DEFAULT 0,
    [PkCount] INT CONSTRAINT [DF_Character_PkCount] DEFAULT 0,
    [PkLevel] INT CONSTRAINT [DF_Character_PkLevel] DEFAULT 3,
    [PkTime] INT CONSTRAINT [DF_Character_PkTime] DEFAULT 0,
    [MDate] SMALLDATETIME,
    [LDate] SMALLDATETIME,
    [CtlCode] TINYINT CONSTRAINT [DF_Character_CtlCode] DEFAULT 0,
    [DbVersion] TINYINT CONSTRAINT [DF__Character__DbVer__787EE5A0] DEFAULT 0,
    [Quest] VARBINARY(50) CONSTRAINT [DF__Character__Quest__797309D9] DEFAULT 0,
    [ChatLimitTime] SMALLINT CONSTRAINT [DF__Character__ChatL__7B5B524B] DEFAULT 0,
    [FruitPoint] INT CONSTRAINT [DF_Character_FruitPoint] DEFAULT 0,
    [EffectList] VARBINARY(208),
    [FruitAddPoint] INT NOT NULL CONSTRAINT [DF__Character__Fruit__4F67C174] DEFAULT 0,
    [FruitSubPoint] INT NOT NULL CONSTRAINT [DF__Character__Fruit__505BE5AD] DEFAULT 0,
    [ResetCount] INT NOT NULL CONSTRAINT [DF_Character_ResetCount] DEFAULT 0,
    [MasterResetCount] INT NOT NULL CONSTRAINT [DF_Character_MasterResetCount] DEFAULT 0,
    CONSTRAINT [PK_Character] PRIMARY KEY NONCLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[CustomPick] (
    [Name] VARCHAR(10) NOT NULL,
    [CustomPickList] VARBINARY(400),
    [Money] INT NOT NULL,
    [Jewel] INT NOT NULL CONSTRAINT [DF_CustomPick_Jewel] DEFAULT 0,
    [ItemExc] INT NOT NULL CONSTRAINT [DF_CustomPick_Excellent] DEFAULT 0,
    [ItemSet] INT NOT NULL CONSTRAINT [DF_CustomPick_Set] DEFAULT 0,
    CONSTRAINT [PK_CustomPick] PRIMARY KEY CLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[DefaultClassType] (
    [Class] TINYINT NOT NULL,
    [Level] SMALLINT CONSTRAINT [DF__DefaultCl__Level__72910220] DEFAULT 0,
    [LevelUpPoint] SMALLINT CONSTRAINT [DF__DefaultCl__Level__73852659] DEFAULT 0,
    [Strength] SMALLINT,
    [Dexterity] SMALLINT,
    [Vitality] SMALLINT,
    [Energy] SMALLINT,
    [Leadership] SMALLINT CONSTRAINT [DF__DefaultCl__Leade__719CDDE7] DEFAULT 0,
    [Inventory] VARBINARY(1728),
    [MagicList] VARBINARY(180),
    [Life] REAL,
    [MaxLife] REAL,
    [Mana] REAL,
    [MaxMana] REAL,
    [MapNumber] SMALLINT,
    [MapPosX] SMALLINT,
    [MapPosY] SMALLINT,
    [Quest] VARBINARY(50),
    [DbVersion] TINYINT,
    [EffectList] VARBINARY(208),
    CONSTRAINT [PK_DefaultClassType] PRIMARY KEY CLUSTERED ([Class])
);

-- CreateTable
CREATE TABLE [dbo].[EventEntryCount] (
    [Account] VARCHAR(10) NOT NULL,
    [Name] VARCHAR(10) NOT NULL,
    [BCCount] INT NOT NULL CONSTRAINT [DF_EventEntryCount_BCCount] DEFAULT 0,
    [CCCount] INT NOT NULL CONSTRAINT [DF_EventEntryCount_CCCount] DEFAULT 0,
    [DSCount] INT NOT NULL CONSTRAINT [DF_EventEntryCount_DSCount] DEFAULT 0,
    [LastDate] SMALLDATETIME NOT NULL CONSTRAINT [DF_EventEntryCount_LastDate] DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE [dbo].[EventGoldenArcher] (
    [Account] VARCHAR(10) NOT NULL,
    [RenaCount] INT NOT NULL CONSTRAINT [DF_EventGoldenArcherCount_RenaCount] DEFAULT 0,
    [StoneCount] INT NOT NULL CONSTRAINT [DF_EventGoldenArcherCount_StoneCount] DEFAULT 0
);

-- CreateTable
CREATE TABLE [dbo].[ExtWarehouse] (
    [AccountID] VARCHAR(10) NOT NULL,
    [Items] VARBINARY(1920),
    [Money] INT,
    [Number] INT
);

-- CreateTable
CREATE TABLE [dbo].[GameServerInfo] (
    [Number] INT NOT NULL CONSTRAINT [DF_GameServerInfo_Number] DEFAULT 0,
    [ItemCount] INT NOT NULL,
    [ZenCount] INT CONSTRAINT [DF_GameServerInfo_ZenCount] DEFAULT 0,
    [AceItemCount] INT,
    CONSTRAINT [PK_GameServerInfo] PRIMARY KEY NONCLUSTERED ([Number])
);

-- CreateTable
CREATE TABLE [dbo].[Guild] (
    [G_Name] VARCHAR(8) NOT NULL,
    [G_Mark] VARBINARY(32),
    [G_Score] INT CONSTRAINT [DF_Guild_G_Score] DEFAULT 0,
    [G_Master] VARCHAR(10),
    [G_Notice] VARCHAR(60),
    [Number] INT NOT NULL IDENTITY(1,1),
    [MemberCount] INT CONSTRAINT [DF__Guild__MemberCou__10566F31] DEFAULT 0,
    CONSTRAINT [PK_Guild] PRIMARY KEY CLUSTERED ([G_Name])
);

-- CreateTable
CREATE TABLE [dbo].[GuildMember] (
    [Name] VARCHAR(10) NOT NULL,
    [G_Name] VARCHAR(8) NOT NULL,
    CONSTRAINT [PK_GuildMember] PRIMARY KEY CLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[MEMB_INFO] (
    [memb_guid] INT NOT NULL IDENTITY(1,1),
    [memb___id] VARCHAR(10) NOT NULL,
    [memb__pwd] VARCHAR(10) NOT NULL,
    [memb_name] VARCHAR(10) NOT NULL,
    [sno__numb] CHAR(18) NOT NULL,
    [post_code] CHAR(6),
    [addr_info] VARCHAR(50),
    [addr_deta] VARCHAR(50),
    [tel__numb] VARCHAR(20),
    [phon_numb] VARCHAR(15),
    [mail_addr] VARCHAR(50),
    [fpas_ques] VARCHAR(50),
    [fpas_answ] VARCHAR(50),
    [job__code] CHAR(2),
    [appl_days] DATETIME,
    [modi_days] DATETIME,
    [out__days] DATETIME,
    [true_days] DATETIME,
    [mail_chek] CHAR(1) CONSTRAINT [DF_MEMB_INFO_mail_chek] DEFAULT '0',
    [bloc_code] CHAR(1) NOT NULL,
    [ctl1_code] CHAR(1) NOT NULL,
    [AccountLevel] INT NOT NULL CONSTRAINT [DF_MEMB_INFO_AccountLevel] DEFAULT 0,
    [AccountExpireDate] SMALLDATETIME NOT NULL CONSTRAINT [DF__MEMB_INFO__Accou__07E124C1] DEFAULT 0,
    CONSTRAINT [PK_MEMB_INFO_1] PRIMARY KEY NONCLUSTERED ([memb_guid] DESC)
);

-- CreateTable
CREATE TABLE [dbo].[MEMB_STAT] (
    [memb___id] VARCHAR(10) NOT NULL,
    [ConnectStat] TINYINT,
    [ServerName] VARCHAR(50),
    [IP] VARCHAR(15),
    [ConnectTM] SMALLDATETIME,
    [DisConnectTM] SMALLDATETIME,
    [OnlineHours] INT CONSTRAINT [DF__MEMB_STAT__Onlin__22751F6C] DEFAULT 0,
    CONSTRAINT [PK_MEMB_STAT] PRIMARY KEY CLUSTERED ([memb___id])
);

-- CreateTable
CREATE TABLE [dbo].[OptionData] (
    [Name] VARCHAR(10) NOT NULL,
    [SkillKey] BINARY(10),
    [GameOption] TINYINT,
    [Qkey] TINYINT,
    [Wkey] TINYINT,
    [Ekey] TINYINT,
    [ChatWindow] TINYINT,
    CONSTRAINT [PK_OptionData] PRIMARY KEY CLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[RankingBloodCastle] (
    [Name] VARCHAR(10) NOT NULL,
    [Score] INT,
    CONSTRAINT [PK_RankingBloodCastle] PRIMARY KEY CLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[RankingChaosCastle] (
    [Name] VARCHAR(10) NOT NULL,
    [Score] INT,
    CONSTRAINT [PK_RankingChaosCastle] PRIMARY KEY CLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[RankingDevilSquare] (
    [Name] VARCHAR(10) NOT NULL,
    [Score] INT,
    CONSTRAINT [PK_RankingDevilSquare] PRIMARY KEY CLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[RankingDuel] (
    [Name] VARCHAR(10) NOT NULL,
    [WinScore] INT,
    [LoseScore] INT,
    CONSTRAINT [PK_RankingDuel] PRIMARY KEY CLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[ResetData] (
    [Account] VARCHAR(10) NOT NULL,
    [Name] VARCHAR(10) NOT NULL,
    [ResetDay] INT NOT NULL CONSTRAINT [DF_ResetData_ResetDay] DEFAULT 0,
    [ResetWek] INT NOT NULL CONSTRAINT [DF_ResetDate_ResetDay1] DEFAULT 0,
    [ResetMon] INT NOT NULL CONSTRAINT [DF_ResetDate_ResetDay2] DEFAULT 0,
    [ResetDateDay] SMALLDATETIME NOT NULL CONSTRAINT [DF_ResetDate_ResetDate] DEFAULT CURRENT_TIMESTAMP,
    [ResetDateWek] SMALLDATETIME NOT NULL CONSTRAINT [DF_ResetDate_ResetDate1] DEFAULT CURRENT_TIMESTAMP,
    [ResetDateMon] SMALLDATETIME NOT NULL CONSTRAINT [DF_ResetDate_ResetDate2] DEFAULT CURRENT_TIMESTAMP,
    [MasterResetDay] INT NOT NULL CONSTRAINT [DF_ResetDate_ResetDay1_1] DEFAULT 0,
    [MasterResetWek] INT NOT NULL CONSTRAINT [DF_ResetDate_ResetWek1] DEFAULT 0,
    [MasterResetMon] INT NOT NULL CONSTRAINT [DF_ResetDate_ResetMon1] DEFAULT 0,
    [MasterResetDateDay] SMALLDATETIME NOT NULL CONSTRAINT [DF_ResetDate_ResetDateDay1] DEFAULT CURRENT_TIMESTAMP,
    [MasterResetDateWek] SMALLDATETIME NOT NULL CONSTRAINT [DF_ResetDate_ResetDateWek1] DEFAULT CURRENT_TIMESTAMP,
    [MasterResetDateMon] SMALLDATETIME NOT NULL CONSTRAINT [DF_ResetDate_ResetDateMon1] DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE [dbo].[T_CGuid] (
    [GUID] INT NOT NULL IDENTITY(1,1),
    [Name] VARCHAR(10) NOT NULL,
    CONSTRAINT [PK_T_CGuid] PRIMARY KEY CLUSTERED ([GUID])
);

-- CreateTable
CREATE TABLE [dbo].[T_FriendList] (
    [GUID] INT NOT NULL,
    [FriendGuid] INT,
    [FriendName] VARCHAR(10),
    [Del] TINYINT CONSTRAINT [DF_T_FriendList_Del] DEFAULT 0
);

-- CreateTable
CREATE TABLE [dbo].[T_FriendMail] (
    [MemoIndex] INT NOT NULL CONSTRAINT [DF_T_FriendMemo_MemoIndex] DEFAULT 10,
    [GUID] INT NOT NULL,
    [FriendName] VARCHAR(10),
    [wDate] SMALLDATETIME NOT NULL CONSTRAINT [DF_T_FriendMemo_wDate] DEFAULT CURRENT_TIMESTAMP,
    [Subject] VARCHAR(50),
    [bRead] BIT NOT NULL CONSTRAINT [DF_T_FriendMemo_MemoRead] DEFAULT 0,
    [Memo] VARBINARY(1000),
    [Photo] BINARY(18),
    [Dir] TINYINT CONSTRAINT [DF_T_FriendMemo_Dir] DEFAULT 0,
    [Act] TINYINT CONSTRAINT [DF_T_FriendMemo_Action] DEFAULT 0,
    CONSTRAINT [PK_T_FriendMemo] PRIMARY KEY CLUSTERED ([GUID],[MemoIndex])
);

-- CreateTable
CREATE TABLE [dbo].[T_FriendMain] (
    [GUID] INT NOT NULL,
    [Name] VARCHAR(10) NOT NULL,
    [FriendCount] TINYINT,
    [MemoCount] INT CONSTRAINT [DF_T_FriendMain_MemoCount] DEFAULT 10,
    [MemoTotal] INT CONSTRAINT [DF_T_FriendMain_MemoTotal] DEFAULT 0,
    CONSTRAINT [PK_T_FriendMain] PRIMARY KEY CLUSTERED ([GUID])
);

-- CreateTable
CREATE TABLE [dbo].[T_PetItem_Info] (
    [ItemSerial] INT NOT NULL,
    [Pet_Level] SMALLINT CONSTRAINT [DF_T_Pet_Info_Pet_Level] DEFAULT 0,
    [Pet_Exp] INT CONSTRAINT [DF_T_Pet_Info_Pet_Exp] DEFAULT 0,
    CONSTRAINT [PK_T_Pet_Info] PRIMARY KEY CLUSTERED ([ItemSerial])
);

-- CreateTable
CREATE TABLE [dbo].[T_WaitFriend] (
    [GUID] INT NOT NULL,
    [FriendGuid] INT NOT NULL,
    [FriendName] VARCHAR(10) NOT NULL
);

-- CreateTable
CREATE TABLE [dbo].[warehouse] (
    [AccountID] VARCHAR(10) NOT NULL,
    [Items] VARBINARY(1920),
    [Money] INT CONSTRAINT [DF_warehouse_Money] DEFAULT 0,
    [EndUseDate] SMALLDATETIME,
    [DbVersion] TINYINT CONSTRAINT [DF__warehouse__DbVer__690797E6] DEFAULT 0,
    [pw] SMALLINT CONSTRAINT [DF__warehouse__pw__69FBBC1F] DEFAULT 0,
    CONSTRAINT [PK_warehouse] PRIMARY KEY CLUSTERED ([AccountID])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

