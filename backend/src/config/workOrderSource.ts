export const WO_SOURCE = `
  SELECT
    CONVERT(VARCHAR(50), m.ColourName) AS woNo,
    mp.Partyid AS partyId,
    m.PartyName AS partyName,
    m.Fono AS foNo,
    MAX(m.MerchName) AS merchName,
    MAX(m.EmployeeName) AS prepBy,
    MAX(m.UnitName) AS unit,
    m.Heading AS process,
    SUM(m.Qty) AS orderQty,
    MAX(m.UomName) AS uom,
    MAX(m.DelayDays) AS delayDays
  FROM TableMerchLock m
  LEFT JOIN MasterParty mp ON m.PartyName = mp.Partyname
  WHERE m.TitleHead LIKE '31A%'
  GROUP BY
    CONVERT(VARCHAR(50), m.ColourName),
    mp.Partyid,
    m.PartyName,
    m.Fono,
    m.Heading
`;
