/** Pinned, public-use release; a revision requires a deliberate checksum update. */
export const RELEASE = {
  fiscalYear: 2024,
  catalogUrl: 'https://snapqcdata.net/datafiles',
  sourceUrl: 'https://snapqcdata.net/sites/default/files/2026-08/qcfy2024_csv.zip',
  dictionaryUrl: 'https://snapqcdata.net/sites/default/files/2026-08/FY-2024-Tech-Doc.pdf',
  archiveSha256: 'b8b29b8593f78aa51c48332c47d2d92fa5bbecf5346570acb45e26f2d9ebd2b5',
  csvSha256: 'e871a8e9caca0be72e2003b09bdf71e1d020984b52289d2b74c4c6b88c4f793b',
  archiveMember: 'qc_pub_fy2024.csv',
  rowCount: 44891,
  columnCount: 1177,
  bytes: 5634728,
} as const;

// USPS abbreviations paired with the codebook's STATE FIPS codes (Appendix E).
const CODES = '01:AL 02:AK 04:AZ 05:AR 06:CA 08:CO 09:CT 10:DE 11:DC 12:FL 13:GA 15:HI 16:ID 17:IL 18:IN 19:IA 20:KS 21:KY 22:LA 23:ME 24:MD 25:MA 26:MI 27:MN 28:MS 29:MO 30:MT 31:NE 32:NV 33:NH 34:NJ 35:NM 36:NY 37:NC 38:ND 39:OH 40:OK 41:OR 42:PA 44:RI 45:SC 46:SD 47:TN 48:TX 49:UT 50:VT 51:VA 53:WA 54:WV 55:WI 56:WY 66:GU 78:VI';
export const STATE_CODES = Object.fromEntries(CODES.split(' ').map((entry) => entry.split(':'))) as Record<string, string>;
