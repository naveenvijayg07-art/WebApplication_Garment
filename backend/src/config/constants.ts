// ============================================================================
// ALL existing ERP tables, views and column names are mapped here.
// ============================================================================

export const TABLES = {
  // Existing ERP tables/views (Read-only)
  MASTER_PARTY: 'MasterParty',
  PARTY_GST: 'MasterParty',
  WORK_ORDER_VIEW: 'ForRsIssueFormSub1GplockAllPrcMail',

  // New Portal Tables
  ADMIN_USER: 'ADMIN_USER',
  SUPPLIER_LOGIN: 'SUPPLIER_LOGIN',
  WO_COMPLETION_UPDATE: 'WO_COMPLETION_UPDATE',
};

export const COLUMNS = {
  MASTER_PARTY: {
    PARTY_ID: 'PartyId',
    PARTY_NAME: 'PartyName',
  },
  PARTY_GST: {
    PARTY_ID: 'PartyId',
    GST_NO: 'GSTNo',
  },
  WORK_ORDER_VIEW: {
    WO_NO: 'Headingsno',
    FONO: 'Fono',
    MERCH_NAME: 'Merchname',
    PARTY_NAME: 'Partyname',
    UNIT_NAME: 'UnitName',
    PROCESS: 'Processname',
    QTY: 'WoQty',
    UOM: 'UomName',
    DELAY_DAYS: 'DelayDays',
  },
};
