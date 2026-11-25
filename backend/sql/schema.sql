-- ============================================================================
-- Portal Schema Setup Script (Run by Database Administrator)
-- Safe scripts with IF OBJECT_ID / IF NOT EXISTS checks
-- ============================================================================

-- 1. SUPPLIER_LOGIN table
IF OBJECT_ID('dbo.SUPPLIER_LOGIN', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SUPPLIER_LOGIN (
        id INT IDENTITY(1,1) PRIMARY KEY,
        party_id NVARCHAR(50) NOT NULL,
        gst_no NVARCHAR(50) NULL,
        password_hash NVARCHAR(255) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        must_change_pwd BIT NOT NULL DEFAULT 1,
        created_by NVARCHAR(50) NULL,
        created_on DATETIME NOT NULL DEFAULT GETDATE(),
        last_login DATETIME NULL
    );
END;

-- Unique index on party_id
-- (Before creating, ensure no duplicates exist using: SELECT party_id, COUNT(*) FROM SUPPLIER_LOGIN GROUP BY party_id HAVING COUNT(*) > 1)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_SUPPLIER_LOGIN_PARTY_ID' AND object_id = OBJECT_ID('dbo.SUPPLIER_LOGIN'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_SUPPLIER_LOGIN_PARTY_ID 
    ON dbo.SUPPLIER_LOGIN(party_id);
END;

-- 2. ADMIN_USER table
IF OBJECT_ID('dbo.ADMIN_USER', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ADMIN_USER (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(50) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1
    );
END;

-- 3. WO_COMPLETION_UPDATE table
IF OBJECT_ID('dbo.WO_COMPLETION_UPDATE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WO_COMPLETION_UPDATE (
        id INT IDENTITY(1,1) PRIMARY KEY,
        wo_no NVARCHAR(50) NOT NULL,
        party_id NVARCHAR(50) NOT NULL,
        completed_qty DECIMAL(18,2) NOT NULL,
        remarks NVARCHAR(500) NULL,
        updated_on DATETIME NOT NULL DEFAULT GETDATE(),
        updated_by NVARCHAR(50) NULL
    );
END;

-- Index for fast lookup and aggregation on (wo_no, party_id)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WO_COMPLETION_UPDATE_WO_PARTY' AND object_id = OBJECT_ID('dbo.WO_COMPLETION_UPDATE'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_WO_COMPLETION_UPDATE_WO_PARTY 
    ON dbo.WO_COMPLETION_UPDATE(wo_no, party_id);
END;
