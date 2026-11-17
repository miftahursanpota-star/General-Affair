const SPREADSHEET_ID = '1yQUB_tEak1v9hX4vc9WsxxdSGfck585GkLt7-flwel8';
const SECRET_PROPERTY = 'SHEET_SECRET_TOKEN';

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || '{}');
    const expectedToken = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);

    if (!expectedToken || payload.secretToken !== expectedToken) {
      return jsonResponse({ status: 'error', message: 'Unauthorized' });
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
    const columnCount = sheet.getLastColumn();
    if (columnCount < 1) {
      return jsonResponse({ status: 'error', message: 'Spreadsheet header row is empty' });
    }

    const headers = sheet.getRange(1, 1, 1, columnCount).getDisplayValues()[0];
    const valuesByHeader = {
      pengajuanpt: payload.pt,
      namapengaju: payload.namaPengaju,
      jabatan: payload.jabatan,
      nowa: payload.waPengaju,
      tanggalpengajuan: payload.tglPengajuan,
      namapenerimavendor: payload.vendor,
      namavendorpenerima: payload.vendor,
      namabank: payload.bank,
      norekvirtualaccount: payload.norek,
      norekeningvirtualaccount: payload.norek,
      namapemilikrekening: payload.namaRekening,
      nominal: payload.nominal,
      nominalpembayaran: payload.nominal,
      nominalpembayaranrp: payload.nominal,
      metodebayar: payload.metodeBayar,
      metodepembayaran: payload.metodeBayar,
      dokumenpendukung: payload.dokumenPendukung,
      lampiran: payload.dokumenPendukung,
      status: 'Pending',
      statusbayar: 'Pending'
    };
    const row = headers.map((header) => {
      const key = String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return Object.prototype.hasOwnProperty.call(valuesByHeader, key) ? valuesByHeader[key] ?? '' : '';
    });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ status: 'success' });
  } catch (error) {
    console.error('Google Sheets append failed:', error.message);
    return jsonResponse({ status: 'error', message: 'Could not append request row' });
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}