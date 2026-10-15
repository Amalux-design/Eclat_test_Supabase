/**
 * Eclat by Harsha — Apps Script backend
 *
 * Sheet: WORK_LOGS
 * Columns: id, date, clientName, work, eventType, qty, price, amount,
 *          paymentStatus, status, own, referrerName, startTime, endTime,
 *          notes, createdAt, updatedAt, clientPhone, location, altPhone,
 *          bridesmaids, paidAmount, privateNotes
 *
 * Script Properties (Project Settings → Script Properties):
 *   ADMIN_PIN   6-digit PIN that unlocks admin mode. Changing it signs out
 *               every admin device (their tokens are derived from the PIN).
 *   TOKEN_SALT  created automatically on first login — leave it alone.
 *   DATA_VERSION, PIN_FAILS, PIN_LOCK_UNTIL — managed automatically.
 *
 * Roles:
 *   viewer  no token. Reads only, and only PUBLIC_FIELDS leave the server.
 *   admin   valid token from `login`. Full reads and all writes.
 */

var SHEET_NAME = "WORK_LOGS";
// New columns are always appended at the end so existing sheets only need
// the header cells added — no column reshuffle.
var HEADERS = [
  "id", "date", "clientName", "work", "eventType", "qty", "price", "amount",
  "paymentStatus", "status", "own", "referrerName", "startTime", "endTime",
  "notes", "createdAt", "updatedAt", "clientPhone", "location", "altPhone",
  "bridesmaids", "paidAmount", "privateNotes",
];

// What assistants (view-only) receive. Everything else — phone numbers,
// money, payment status, referrer — is stripped before the response is sent.
var PUBLIC_FIELDS = [
  "id", "date", "clientName", "work", "eventType", "status", "startTime",
  "endTime", "notes", "location", "bridesmaids", "updatedAt",
];

// Columns forced to plain text so Sheets doesn't turn "2026-08-16" / "17:00"
// into Dates or drop the leading "+"/"0" from phone numbers.
var TEXT_COLUMNS = ["date", "startTime", "endTime", "clientPhone", "altPhone"];

var CACHE_KEY = "work_logs_v2";
var CACHE_TTL_SECONDS = 21600; // 6 hours — CacheService's max

// Wrong-PIN lockout: 3 misses → 60 s, every miss after that → 5 min.
var FREE_ATTEMPTS = 3;
var FIRST_LOCK_MS = 60 * 1000;
var LONG_LOCK_MS = 5 * 60 * 1000;

/* ---------- routing ---------- */

function doGet(e) {
  return route(e);
}

function doPost(e) {
  return route(e);
}

function route(e) {
  var body = {};
  if (e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ success: false, error: "Invalid JSON body" });
    }
  }
  var action = body.action || (e.parameter && e.parameter.action);
  var admin = isAdminToken(body.token);

  try {
    var data;
    switch (action) {
      case "getVersion":
        data = { version: getDataVersion() };
        break;
      case "getLogs":
        data = { logs: visibleLogs(getLogs(), admin), version: getDataVersion(), admin: admin };
        break;
      case "login":
        data = login(body.pin);
        break;
      case "createLog":
        requireAdmin(admin);
        data = withLock(function () { return createLog(body); });
        break;
      case "updateLog":
        requireAdmin(admin);
        data = withLock(function () { return updateLog(body); });
        break;
      case "deleteLog":
        requireAdmin(admin);
        data = withLock(function () { return deleteLog(body); });
        break;
      default:
        throw new Error("Unknown action: " + action);
    }
    return jsonResponse({ success: true, data: data });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message || String(err), code: err.code || "ERROR" });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ---------- auth ---------- */

function props() {
  return PropertiesService.getScriptProperties();
}

function authError(message) {
  var err = new Error(message);
  err.code = "AUTH";
  return err;
}

function requireAdmin(admin) {
  if (!admin) throw authError("Admin PIN required");
}

function tokenFor(pin) {
  var p = props();
  var salt = p.getProperty("TOKEN_SALT");
  if (!salt) {
    salt = Utilities.getUuid();
    p.setProperty("TOKEN_SALT", salt);
  }
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin + ":" + salt);
  return Utilities.base64EncodeWebSafe(digest);
}

function isAdminToken(token) {
  if (!token) return false;
  var pin = props().getProperty("ADMIN_PIN");
  if (!pin) return false;
  return token === tokenFor(pin);
}

function login(pin) {
  return withLock(function () {
    var p = props();
    var adminPin = p.getProperty("ADMIN_PIN");
    if (!adminPin) throw new Error("ADMIN_PIN is not set in Script Properties");

    var now = Date.now();
    var lockUntil = Number(p.getProperty("PIN_LOCK_UNTIL")) || 0;
    if (lockUntil > now) {
      return { ok: false, lockedUntil: lockUntil };
    }

    if (String(pin) === String(adminPin)) {
      p.deleteProperty("PIN_FAILS");
      p.deleteProperty("PIN_LOCK_UNTIL");
      return { ok: true, token: tokenFor(adminPin) };
    }

    var fails = (Number(p.getProperty("PIN_FAILS")) || 0) + 1;
    p.setProperty("PIN_FAILS", String(fails));
    var result = { ok: false, attemptsLeft: Math.max(FREE_ATTEMPTS - fails, 0) };
    if (fails >= FREE_ATTEMPTS) {
      var until = now + (fails === FREE_ATTEMPTS ? FIRST_LOCK_MS : LONG_LOCK_MS);
      p.setProperty("PIN_LOCK_UNTIL", String(until));
      result.lockedUntil = until;
    }
    return result;
  });
}

/* ---------- versioning & cache ---------- */

function getDataVersion() {
  return props().getProperty("DATA_VERSION") || "0";
}

// Called after every write so polling clients know to refetch.
function markChanged() {
  props().setProperty("DATA_VERSION", String(Date.now()));
  try {
    CacheService.getScriptCache().remove(CACHE_KEY);
  } catch (err) {
    // no-op
  }
}

// Simple trigger: edits made directly in the Sheet also bump the version, so
// the app picks them up on its next poll instead of waiting out the cache.
function onEdit() {
  markChanged();
}

function getCachedLogs() {
  try {
    var cached = CacheService.getScriptCache().get(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    return null;
  }
}

function setCachedLogs(logs) {
  try {
    CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(logs), CACHE_TTL_SECONDS);
  } catch (err) {
    // Payload over the 100KB-per-key limit — cache is optional, skip it.
  }
}

function visibleLogs(logs, admin) {
  if (admin) return logs;
  return logs.map(function (log) {
    var out = {};
    PUBLIC_FIELDS.forEach(function (key) {
      out[key] = log[key];
    });
    return out;
  });
}

/* ---------- sheet helpers ---------- */

function getSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found");
  return sheet;
}

// Sheets auto-converts strings that look like dates/times into Date values;
// getValues() then hands back Dates that serialize as UTC timestamps. Convert
// back to plain strings in the sheet's own timezone so nothing shifts.
function formatDateCell(value) {
  if (!(value instanceof Date)) return value;
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(value, tz, "yyyy-MM-dd");
}

function formatTimeCell(value) {
  if (!(value instanceof Date)) return value;
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(value, tz, "HH:mm");
}

function rowToObject(row) {
  var obj = {};
  for (var i = 0; i < HEADERS.length; i++) {
    obj[HEADERS[i]] = row[i];
  }
  obj.date = formatDateCell(obj.date);
  obj.startTime = formatTimeCell(obj.startTime) || "";
  obj.endTime = formatTimeCell(obj.endTime) || "";
  obj.amount = Number(obj.amount) || 0;
  obj.qty = Number(obj.qty) || 1;
  obj.price = Number(obj.price) || obj.amount;
  obj.bridesmaids = Number(obj.bridesmaids) || 0;
  obj.paidAmount = Number(obj.paidAmount) || 0;
  obj.own = obj.own === true || obj.own === "TRUE" || obj.own === "true";
  ["clientPhone", "altPhone", "location", "notes", "privateNotes", "referrerName", "eventType"].forEach(function (k) {
    obj[k] = obj[k] === undefined || obj[k] === null ? "" : String(obj[k]);
  });
  return obj;
}

function objectToRow(obj) {
  return HEADERS.map(function (h) {
    if (h === "own") return obj[h] === true;
    return obj[h] !== undefined ? obj[h] : "";
  });
}

function forceTextFormat(sheet, rowIndex) {
  TEXT_COLUMNS.forEach(function (key) {
    sheet.getRange(rowIndex, HEADERS.indexOf(key) + 1).setNumberFormat("@");
  });
}

function getLogs() {
  var cached = getCachedLogs();
  if (cached) return cached;

  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  var rows = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var logs = rows
    .filter(function (row) { return row[0] !== ""; })
    .map(rowToObject);
  logs.sort(function (a, b) {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  });
  setCachedLogs(logs);
  return logs;
}

// TextFinder searches the id column natively instead of pulling every id into
// the script — much faster once the sheet has a few hundred rows.
function findRowIndexById(id) {
  if (!id) return -1;
  var sheet = getSheet();
  if (sheet.getLastRow() < 2) return -1;
  var cell = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();
  return cell ? cell.getRow() : -1;
}

/* ---------- writes ---------- */

function normalizeInput(input, base) {
  var out = {};
  for (var i = 0; i < HEADERS.length; i++) {
    var key = HEADERS[i];
    out[key] = input[key] !== undefined ? input[key] : base[key];
  }
  out.qty = Number(out.qty) || 1;
  out.amount = Number(out.amount) || 0;
  out.price = Number(out.price) || out.amount;
  out.bridesmaids = Number(out.bridesmaids) || 0;
  out.paidAmount = Number(out.paidAmount) || 0;
  out.own = out.own === true || out.own === "true";
  return out;
}

// The app creates ids on the device so bookings work offline. If a retry
// arrives for an id that already exists (the first attempt reached the sheet
// but the response was lost), treat it as an update — saves are idempotent.
function createLog(input) {
  if (input.id && findRowIndexById(input.id) !== -1) {
    return updateLog(input);
  }
  var sheet = getSheet();
  var now = new Date().toISOString();
  var log = normalizeInput(input, {
    clientName: "", clientPhone: "", altPhone: "", work: "", eventType: "",
    location: "", referrerName: "", startTime: "", endTime: "", notes: "",
    privateNotes: "", paidAmount: 0,
    paymentStatus: "PENDING", status: "RESERVED", own: true, bridesmaids: 0,
  });
  log.id = input.id || Utilities.getUuid();
  log.createdAt = now;
  log.updatedAt = now;
  // Mark the new row's phone/date/time cells as text BEFORE writing, so
  // Sheets stores exactly what the app sends (no number/date conversion).
  var rowIndex = sheet.getLastRow() + 1;
  forceTextFormat(sheet, rowIndex);
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([objectToRow(log)]);
  markChanged();
  return log;
}

function updateLog(input) {
  var sheet = getSheet();
  var rowIndex = findRowIndexById(input.id);
  if (rowIndex === -1) throw new Error("Booking not found: " + input.id);

  var existing = rowToObject(sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0]);
  var updated = normalizeInput(input, existing);
  updated.id = existing.id;
  updated.createdAt = existing.createdAt;
  updated.updatedAt = new Date().toISOString();

  forceTextFormat(sheet, rowIndex);
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([objectToRow(updated)]);
  markChanged();
  return updated;
}

// Deleting something already gone is a success, so a retried delete never
// gets stuck in the app's save queue.
function deleteLog(input) {
  var rowIndex = findRowIndexById(input.id);
  if (rowIndex !== -1) {
    getSheet().deleteRow(rowIndex);
    markChanged();
  }
  return { id: input.id };
}

/**
 * Run once by hand (Apps Script editor → select repairTextColumns → Run).
 * Formats the whole phone/date/time columns as plain text, including empty
 * rows below the data, so numbers typed straight into the Sheet stay exactly
 * as typed. It does not change any existing values. (A leading 0 or + that
 * Sheets already removed in the past can't be restored automatically, but
 * the app still dials 10-digit mobiles correctly as +91.)
 */
function repairTextColumns() {
  var sheet = getSheet();
  var rows = Math.max(sheet.getMaxRows() - 1, 1);
  TEXT_COLUMNS.forEach(function (key) {
    sheet.getRange(2, HEADERS.indexOf(key) + 1, rows, 1).setNumberFormat("@");
  });
}
