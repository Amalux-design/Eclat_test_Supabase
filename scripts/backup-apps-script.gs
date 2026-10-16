/**
 * Éclat daily backup → Google Sheet.
 * Paste into the backup sheet: Extensions → Apps Script. Fill in the three
 * values below, run backupNow() once (allow access), then run installDaily().
 */
const SUPABASE_URL = "https://kppfwtaagqasbvofztuv.supabase.co";
const ANON_KEY = "PASTE-THE-ANON-KEY";
const BACKUP_SECRET = "PASTE-THE-SAME-SECRET-AS-IN-backup.sql";
const KEEP_DAILY_COPIES = 14; // dated tabs kept, oldest deleted

const COLUMNS = [
  "date", "client_name", "client_phone", "alt_phone", "services", "event", "venue",
  "bridesmaids", "start_time", "ready_by", "status", "amount", "paid_amount",
  "payment_status", "own", "referrer", "team_notes", "private_notes",
  "created_at", "updated_at", "id",
];

function backupNow() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/rpc/backup_export", {
    method: "post",
    contentType: "application/json",
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
    payload: JSON.stringify({ p_secret: BACKUP_SECRET }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("Backup failed: " + res.getContentText());
  const rows = JSON.parse(res.getContentText());
  // Phones as text so leading digits and length stay exactly as stored.
  const values = [COLUMNS].concat(rows.map((r) => COLUMNS.map((c) =>
    r[c] == null ? "" : (c.indexOf("phone") >= 0 ? "'" + r[c] : r[c]))));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stamp = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  writeTab(ss, "Latest", values);
  writeTab(ss, "Backup " + stamp, values);

  // Keep only the newest dated copies.
  const dated = ss.getSheets().filter((s) => /^Backup \d{4}-\d{2}-\d{2}$/.test(s.getName()))
    .sort((a, b) => b.getName().localeCompare(a.getName()));
  dated.slice(KEEP_DAILY_COPIES).forEach((s) => ss.deleteSheet(s));

  ss.getSheetByName("Latest").getRange(1, COLUMNS.length + 2)
    .setValue("Last backup: " + Utilities.formatDate(new Date(), "Asia/Kolkata", "d MMM yyyy, h:mm a") + " · " + rows.length + " bookings");
}

function writeTab(ss, name, values) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  sh.getRange(1, 1, values.length, values[0].length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, values[0].length).setFontWeight("bold");
}

/** Run once: backs up every day around 2 am India time. */
function installDaily() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("backupNow").timeBased().everyDays(1).atHour(2).inTimezone("Asia/Kolkata").create();
}
