/**
 * Noname 1 - Google Apps Script API
 * Sheet header order:
 * 제목 | 태그 | 공개여부 | 본문 | 작가코멘트 | 인스타링크 | 제작일시 | 수정시각
 */

const SHEET_NAME = 'items';
const HEADER_ROW = 1;
const DATA_START_ROW = 2;
const ADMIN_PASSWORD = 'PWnoname1!';

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  try {
    const payload = buildPayload_(e);
    const action = (e.parameter.action || payload.action || 'list').toLowerCase();
    const publishedOnly = String(e.parameter.publishedOnly || payload.publishedOnly || 'true') === 'true';

    // 공개 목록 조회는 인증 없이 허용
    if (!(action === 'list' && publishedOnly) && action !== 'login') {
      const password = payload.password || e.parameter.password || '';
      if (!isAuthorized_(password)) {
        return jsonResponse_({ ok: false, message: 'Unauthorized' });
      }
    }

    switch (action) {
      case 'list':
        return jsonResponse_({ ok: true, data: listRecords_(publishedOnly) });
      case 'login':
        return jsonResponse_(verifyAdminLogin_(payload));
      case 'create':
        return jsonResponse_({ ok: true, data: createRecord_(payload) });
      case 'update':
        return jsonResponse_({ ok: true, data: updateRecord_(payload) });
      case 'delete':
        return jsonResponse_({ ok: true, data: deleteRecord_(payload) });
      case 'reorder':
        return jsonResponse_({ ok: true, data: reorderRecords_(payload) });
      case 'publish':
        return jsonResponse_({ ok: true, data: publishRecord_(payload) });
      default:
        return jsonResponse_({ ok: false, message: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse_({ ok: false, message: String(error) });
  }
}

function buildPayload_(e) {
  const fromBody = parsePayload_(e);
  const fromParams = e && e.parameter ? e.parameter : {};
  const payload = Object.assign({}, fromParams, fromBody);

  // form-urlencoded 에서 배열/객체를 JSON 문자열로 보낸 경우 복원
  if (typeof payload.orders === 'string') {
    try {
      payload.orders = JSON.parse(payload.orders);
    } catch (error) {
      // keep original value
    }
  }

  if (typeof payload.items === 'string') {
    try {
      payload.items = JSON.parse(payload.items);
    } catch (error) {
      // keep original value
    }
  }

  return payload;
}

function verifyAdminLogin_(payload) {
  const incomingPassword = String(payload.password || '');
  if (incomingPassword !== ADMIN_PASSWORD) {
    return { ok: false, message: 'Invalid password' };
  }

  return { ok: true, message: 'Login success' };
}

function parsePayload_(e) {
  try {
    if (e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch (error) {
    // Ignore parse errors and return empty payload.
  }
  return {};
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isAuthorized_(incomingPassword) {
  return String(incomingPassword || '') === ADMIN_PASSWORD;
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];
  if (!sheet) {
    throw new Error('Sheet not found');
  }
  return sheet;
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function (name, idx) {
    map[String(name).trim()] = idx;
  });
  return map;
}

function normalizePublish_(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '공개';
  if (['공개', 'yes', 'y', 'true', '1', 'on'].indexOf(raw) > -1) return '공개';
  return '비공개';
}

function formatDateTime_(date) {
  const tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  return Utilities.formatDate(date, tz, 'yyyy-MM-dd HH:mm');
}

function rowToRecord_(rowId, row, map) {
  return {
    rowId: rowId,
    제목: row[map['제목']] || '',
    태그: row[map['태그']] || '',
    공개여부: normalizePublish_(row[map['공개여부']]),
    본문: row[map['본문']] || '',
    작가코멘트: row[map['작가코멘트']] || '',
    인스타링크: row[map['인스타링크']] || '',
    제작일시: row[map['제작일시']] || '',
    수정시각: row[map['수정시각']] || ''
  };
}

function listRecords_(publishedOnly) {
  const sheet = getSheet_();
  const map = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return [];

  const values = sheet.getRange(DATA_START_ROW, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const records = values.map(function (row, idx) {
    return rowToRecord_(idx + DATA_START_ROW, row, map);
  });

  return records.filter(function (r) {
    return !publishedOnly || r.공개여부 === '공개';
  });
}

function createRecord_(payload) {
  const sheet = getSheet_();
  const map = getHeaderMap_(sheet);

  const row = new Array(sheet.getLastColumn()).fill('');
  row[map['제목']] = payload.제목 || '';
  row[map['태그']] = payload.태그 || '';
  row[map['공개여부']] = normalizePublish_(payload.공개여부);
  row[map['본문']] = payload.본문 || '';
  row[map['작가코멘트']] = payload.작가코멘트 || '';
  row[map['인스타링크']] = payload.인스타링크 || '';
  row[map['제작일시']] = payload.제작일시 || formatDateTime_(new Date());
  row[map['수정시각']] = formatDateTime_(new Date());

  sheet.appendRow(row);
  const rowId = sheet.getLastRow();
  return { rowId: rowId };
}

function updateRecord_(payload) {
  const rowId = Number(payload.rowId);
  if (!rowId || rowId < DATA_START_ROW) throw new Error('Invalid rowId');

  const sheet = getSheet_();
  const map = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  if (rowId > lastRow) throw new Error('rowId out of range');

  const row = sheet.getRange(rowId, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (Object.prototype.hasOwnProperty.call(payload, '제목')) row[map['제목']] = payload.제목;
  if (Object.prototype.hasOwnProperty.call(payload, '태그')) row[map['태그']] = payload.태그;
  if (Object.prototype.hasOwnProperty.call(payload, '공개여부')) row[map['공개여부']] = normalizePublish_(payload.공개여부);
  if (Object.prototype.hasOwnProperty.call(payload, '본문')) row[map['본문']] = payload.본문;
  if (Object.prototype.hasOwnProperty.call(payload, '작가코멘트')) row[map['작가코멘트']] = payload.작가코멘트;
  if (Object.prototype.hasOwnProperty.call(payload, '인스타링크')) row[map['인스타링크']] = payload.인스타링크;
  if (Object.prototype.hasOwnProperty.call(payload, '제작일시')) row[map['제작일시']] = payload.제작일시;
  row[map['수정시각']] = formatDateTime_(new Date());

  sheet.getRange(rowId, 1, 1, sheet.getLastColumn()).setValues([row]);
  return { rowId: rowId };
}

function deleteRecord_(payload) {
  const rowId = Number(payload.rowId);
  if (!rowId || rowId < DATA_START_ROW) throw new Error('Invalid rowId');

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (rowId > lastRow) throw new Error('rowId out of range');

  sheet.deleteRow(rowId);
  return { deleted: true };
}

function reorderRecords_(payload) {
  const orders = payload.orders || payload.items || [];
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('orders is required');
  }

  const sheet = getSheet_();
  const map = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return { reordered: 0 };

  const values = sheet.getRange(DATA_START_ROW, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const rows = values.map(function (row, idx) {
    return { rowId: idx + DATA_START_ROW, row: row };
  });

  const orderMap = {};
  orders.forEach(function (item, idx) {
    const rowId = Number(item.rowId);
    if (!rowId) return;
    const score = Number(item.order);
    orderMap[rowId] = Number.isNaN(score) ? idx : score;
  });

  rows.sort(function (a, b) {
    const aScore = Object.prototype.hasOwnProperty.call(orderMap, a.rowId) ? orderMap[a.rowId] : (100000 + a.rowId);
    const bScore = Object.prototype.hasOwnProperty.call(orderMap, b.rowId) ? orderMap[b.rowId] : (100000 + b.rowId);
    if (aScore === bScore) return a.rowId - b.rowId;
    return aScore - bScore;
  });

  const now = new Date();
  const sorted = rows.map(function (item) {
    item.row[map['수정시각']] = formatDateTime_(now);
    return item.row;
  });

  sheet.getRange(DATA_START_ROW, 1, sorted.length, sheet.getLastColumn()).setValues(sorted);
  return { reordered: sorted.length };
}

function publishRecord_(payload) {
  const rowId = Number(payload.rowId);
  if (!rowId || rowId < DATA_START_ROW) throw new Error('Invalid rowId');

  const sheet = getSheet_();
  const map = getHeaderMap_(sheet);
  const lastRow = sheet.getLastRow();
  if (rowId > lastRow) throw new Error('rowId out of range');

  const row = sheet.getRange(rowId, 1, 1, sheet.getLastColumn()).getValues()[0];
  row[map['공개여부']] = normalizePublish_(payload.공개여부);
  row[map['수정시각']] = formatDateTime_(new Date());

  sheet.getRange(rowId, 1, 1, sheet.getLastColumn()).setValues([row]);
  return { rowId: rowId, 공개여부: row[map['공개여부']] };
}

// 관리자 비밀번호는 ADMIN_PASSWORD 상수로 관리합니다.
