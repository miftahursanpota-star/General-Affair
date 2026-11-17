import { Hono } from 'hono';

const app = new Hono();
const getConfiguredPins = (env) => ({
  ga: typeof env.PIN_GA === 'string' ? env.PIN_GA.trim() : '',
  pimpinan: typeof env.PIN_PIMPINAN === 'string' ? env.PIN_PIMPINAN.trim() : '',
  finance: typeof env.PIN_FINANCE === 'string' ? env.PIN_FINANCE.trim() : ''
});

// ==========================================
// 1. ENDPOINT PENGAJUAN BARANG (MULTI-ITEM SUPPORT)
// ==========================================
app.post('/api/pengajuan-barang', async (c) => {
  try {
    const body = await c.req.json();
    const {
      pt,
      tglPengajuan,
      pemohon,
      namaBarang,
      qty,
      hargaSatuan,
      totalEstimasi,
      supplier,
      keperluan,
      tglDibutuhkan,
      lampiran,
      items
    } = body;

    // Ambil Secret & Environment Variables dari Cloudflare
    const WABLAS_TOKEN = c.env.WABLAS_TOKEN;
    const TARGET_PHONE = c.env.TARGET_PHONE;
    const WABLAS_API_URL = c.env.WABLAS_API_URL || 'https://pati.wablas.com/api/send-message';

    if (!WABLAS_TOKEN || !TARGET_PHONE) {
      return c.json({
        status: 'error',
        message: 'Secret WABLAS_TOKEN dan TARGET_PHONE harus didaftarkan di Cloudflare sebelum notifikasi dapat dikirim.'
      }, 500);
    }

    // Format nama barang jika multi-item
    let formattedNamaBarang = namaBarang;
    let totalQty = parseInt(qty) || 0;
    let itemDetailList = '';
    let finalSupplier = supplier || '-';

    if (Array.isArray(items) && items.length > 0) {
      totalQty = items.reduce((sum, it) => sum + (parseInt(it.qty) || 0), 0);
      formattedNamaBarang = items.map((it, idx) => {
        const tokoText = it.toko && it.toko !== '-' ? ` [${it.toko}]` : '';
        return `${idx + 1}. ${it.nama}${tokoText} (${it.qty} ${it.satuan || 'pcs'} @ Rp ${it.hargaSatuan})`;
      }).join(', ');

      itemDetailList = items.map((it, idx) => {
        const tokoRow = it.toko && it.toko !== '-' ? `\n      • Supplier / Toko: *${it.toko}*` : '';
        return `   ${idx + 1}. *${it.nama}*\n      • Qty: ${it.qty} ${it.satuan || 'pcs'}${tokoRow}\n      • Harga Satuan: Rp ${it.hargaSatuan}\n      • Subtotal: Rp ${it.subtotal || '-'}`;
      }).join('\n\n');

      const uniqueStores = [...new Set(items.map(it => it.toko).filter(t => t && t !== '-'))];
      if (uniqueStores.length > 0) {
        finalSupplier = uniqueStores.join(', ');
      }
    }

    // 1. SIMPAN KE DATABASE CLOUDFLARE D1 (Default Status: Requested)
    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT INTO pengajuan_barang 
        (pt, tgl_pengajuan, pemohon, nama_barang, qty, harga_satuan, total_estimasi, supplier, keperluan, tgl_dibutuhkan, lampiran, status_acc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Requested')
      `).bind(
        pt,
        tglPengajuan,
        pemohon,
        formattedNamaBarang,
        totalQty,
        hargaSatuan || '-',
        totalEstimasi,
        finalSupplier,
        keperluan,
        tglDibutuhkan,
        lampiran || '-'
      ).run();
    }

    // 2. KIRIM PESAN VIA WABLAS API
    let messageText = '';
    if (itemDetailList) {
      messageText = `*FORM REQUEST PEMBELIAN BARANG (MULTI-ITEM)*\nPerusahaan: *${pt}*\nTanggal Pengajuan: ${tglPengajuan}\nPemohon: ${pemohon}\n\n*RINCIAN BARANG DIAJUKAN:*\n${itemDetailList}\n\n*TOTAL ESTIMASI KESELURUHAN: ${totalEstimasi}*\nSupplier / Toko: ${finalSupplier}\nKeperluan Pembelian: ${keperluan}\nTanggal Dibutuhkan: *${tglDibutuhkan}*\nStatus: *Requested*\nLampiran: ${lampiran || '-'}\n\nMohon approval untuk pembelian barang tersebut. Terima kasih.`;
    } else {
      messageText = `*FORM REQUEST PEMBELIAN BARANG*\nPerusahaan: ${pt}\nTanggal Pengajuan: ${tglPengajuan}\nPemohon / Divisi: ${pemohon}\nNama Barang: ${namaBarang}\nJumlah: ${qty}\nEstimasi Harga Satuan: Rp ${hargaSatuan}\nTotal Estimasi: ${totalEstimasi}\nSupplier / Toko: ${finalSupplier}\nKeperluan Pembelian: ${keperluan}\nTanggal Dibutuhkan: *${tglDibutuhkan}*\nStatus: Requested\nLampiran: ${lampiran || '-'}\n\nMohon approval untuk pembelian barang tersebut. Terima kasih.`;
    }

    const response = await fetch(WABLAS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': WABLAS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: TARGET_PHONE,
        message: messageText
      })
    });

    const wablasData = await response.json().catch(() => ({}));

    return c.json({
      status: 'success',
      message: 'Pengajuan tersimpan di Cloudflare D1 & terkirim ke Wablas!',
      data: wablasData
    });

  } catch (error) {
    return c.json({
      status: 'error',
      message: 'Gagal memproses pengajuan',
      detail: error.message
    }, 500);
  }
});

// ==========================================
// 1.B ENDPOINT PERBAIKAN ASET
// ==========================================
app.post('/api/perbaikan-aset', async (c) => {
  try {
    const body = await c.req.json();
    const {
      pt,
      namaPengaju,
      nik,
      jabatan,
      divisi,
      atasanLangsung,
      waPengaju,
      namaAset,
      merkTipe,
      nomorSeri,
      kodeInventaris,
      qty,
      kelengkapan,
      jenisKerusakan,
      tglKejadian,
      deskripsiMasalah,
      keterangan,
      fotoKerusakan
    } = body;

    if (!pt || !namaPengaju || !namaAset || !jenisKerusakan) {
      return c.json({ status: 'error', message: 'Mohon lengkapi formulir perbaikan aset!' }, 400);
    }

    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT INTO perbaikan_aset 
        (pt, nama_pengaju, nik, jabatan, divisi, atasan_langsung, wa_pengaju, nama_aset, merk_tipe, nomor_seri, kode_inventaris, qty, kelengkapan, jenis_kerusakan, tgl_kejadian, deskripsi_masalah, keterangan, foto_kerusakan, status_acc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Requested')
      `).bind(
        pt,
        namaPengaju,
        nik || '-',
        jabatan || '-',
        divisi || '-',
        atasanLangsung || '-',
        waPengaju || '-',
        namaAset,
        merkTipe || '-',
        nomorSeri || '-',
        kodeInventaris || '-',
        parseInt(qty) || 1,
        kelengkapan || '-',
        jenisKerusakan,
        tglKejadian || '-',
        deskripsiMasalah || '-',
        keterangan || '-',
        fotoKerusakan || '-'
      ).run();
    }

    // Notifikasi WhatsApp via Wablas
    const WABLAS_TOKEN = c.env.WABLAS_TOKEN;
    const TARGET_PHONE = c.env.TARGET_PHONE;
    const WABLAS_API_URL = c.env.WABLAS_API_URL || 'https://pati.wablas.com/api/send-message';

    if (WABLAS_TOKEN && TARGET_PHONE) {
      const msg = `*TIKET PERBAIKAN ASET BARU*\nPerusahaan: *${pt}*\nPengaju: ${namaPengaju} (${jabatan} - ${divisi})\nAtasan Langsung: ${atasanLangsung || '-'}\nNo WA: ${waPengaju || '-'}\n\n*DETAIL ASET:*\n• Nama Aset: *${namaAset}*\n• Merk/Tipe: ${merkTipe || '-'}\n• No Seri (SN): ${nomorSeri || '-'}\n• Kode Inventaris: ${kodeInventaris || '-'}\n• Qty: ${qty || 1} Unit\n• Kelengkapan: ${kelengkapan || '-'}\n\n*KENDALA / KERUSAKAN:*\n• Jenis Kerusakan: *${jenisKerusakan}*\n• Tgl Kejadian: ${tglKejadian}\n• Gejala: ${deskripsiMasalah}\n• Catatan: ${keterangan || '-'}\n\nStatus: *Requested*\nMohon segera ditindaklanjuti oleh GA / Maintenance. Terima kasih.`;

      fetch(WABLAS_API_URL, {
        method: 'POST',
        headers: { 'Authorization': WABLAS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: TARGET_PHONE, message: msg })
      }).catch(err => console.warn('Wablas perbaikan err:', err.message));
    }

    return c.json({ status: 'success', message: 'Tiket perbaikan aset berhasil disimpan & dikirim ke GA!' });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Endpoint Fetch Data Monitoring (Pengadaan Barang & Perbaikan Aset)
app.get('/api/monitoring', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json([]);
    }

    // 1. Fetch Pengajuan Barang
    const pengajuanRes = await c.env.DB.prepare(`
      SELECT id, pt, tgl_pengajuan, pemohon, nama_barang, qty, harga_satuan, total_estimasi, supplier, keperluan, tgl_dibutuhkan, status_acc, 'PENGADAAN' as tipe, created_at
      FROM pengajuan_barang 
      ORDER BY id DESC
    `).all();

    // 2. Fetch Perbaikan Aset
    let perbaikanRes = { results: [] };
    try {
      perbaikanRes = await c.env.DB.prepare(`
        SELECT id, pt, tgl_kejadian as tgl_pengajuan, 
               (nama_pengaju || ' (' || jabatan || ' / ' || divisi || ')') as pemohon, 
               (nama_aset || ' [' || COALESCE(merk_tipe, '-') || ']') as nama_barang, 
               qty, '-' as harga_satuan, 
               jenis_kerusakan as total_estimasi, 
               deskripsi_masalah as keperluan, 
               status_acc, 'PERBAIKAN' as tipe, created_at
        FROM perbaikan_aset 
        ORDER BY id DESC
      `).all();
    } catch (e) {
      console.warn("DB perbaikan_aset fetch warning:", e.message);
    }

    const allItems = [
      ...(pengajuanRes.results || []),
      ...(perbaikanRes.results || [])
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return c.json(allItems);
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Endpoint Update Status ACC (Otorisasi PIN Pimpinan & GA)
app.post('/api/update-status', async (c) => {
  try {
    const body = await c.req.json();
    const { id, status, pin, tipe } = body;

    if (!id || !status || !pin) {
      return c.json({
        status: 'error',
        message: 'Data tidak lengkap (ID, Status, dan PIN wajib diisi).'
      }, 400);
    }

    const pins = getConfiguredPins(c.env);
    if (Object.values(pins).some((value) => !value)) {
      return c.json({ status: 'error', message: 'PIN otorisasi belum dikonfigurasi di Cloudflare.' }, 503);
    }

    const inputPin = String(pin).trim();
    const isGA = inputPin === pins.ga;
    const isPimpinan = inputPin === pins.pimpinan;
    const isFinance = inputPin === pins.finance;

    if (!isGA && !isPimpinan && !isFinance) {
      return c.json({
        status: 'error',
        message: 'PIN Otorisasi salah! Akses ditolak.'
      }, 403);
    }

    // Aturan Hak Akses:
    // 1. Status 'Receiving' HANYA bisa dilakukan oleh GA
    if (status === 'Receiving' && !isGA) {
      return c.json({
        status: 'error',
        message: 'Status "Receiving" hanya dapat dilakukan oleh GA (Gunakan PIN GA)!'
      }, 403);
    }

    // 2. Update sesuai jenis tiket (PENGADAAN atau PERBAIKAN)
    if (c.env.DB) {
      if (tipe === 'PERBAIKAN') {
        await c.env.DB.prepare(`
          UPDATE perbaikan_aset 
          SET status_acc = ? 
          WHERE id = ?
        `).bind(status, id).run();
      } else {
        await c.env.DB.prepare(`
          UPDATE pengajuan_barang 
          SET status_acc = ? 
          WHERE id = ?
        `).bind(status, id).run();
      }
    }

    return c.json({
      status: 'success',
      message: `Status berhasil diubah menjadi "${status}"!`
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: 'Gagal memperbarui status: ' + error.message
    }, 500);
  }
});

// ==========================================
// 2. ENDPOINT REQUEST BAYAR (GA KE FINANCE)
// ==========================================
app.post('/api/request-bayar', async (c) => {
  try {
    const body = await c.req.json();
    const {
      pt,
      namaPengaju,
      waPengaju,
      jabatan,
      divisi,
      tglPengajuan,
      vendor,
      bank,
      norek,
      namaRekening,
      nominal,
      metodeBayar,
      dokumenPendukung
    } = body;

    if (!pt || !vendor || !nominal || !norek) {
      return c.json({
        status: 'error',
        message: 'Mohon lengkapi formulir pengajuan pembayaran!'
      }, 400);
    }

    // 1. Simpan ke Database D1
    let insertedId = null;
    if (c.env.DB) {
      try {
        const res = await c.env.DB.prepare(`
          INSERT INTO request_bayar
          (pt, nama_pengaju, wa_pengaju, jabatan, divisi, tgl_pengajuan, vendor, bank, norek, nama_rekening, nominal, metode_bayar, dokumen_pendukung, status_bayar)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `).bind(
          pt,
          namaPengaju || '-',
          waPengaju || '-',
          jabatan || '-',
          divisi || '-',
          tglPengajuan || '-',
          vendor,
          bank || '-',
          norek,
          namaRekening || '-',
          parseInt(nominal) || 0,
          metodeBayar || 'Transfer Bank',
          dokumenPendukung || '-'
        ).run();

        insertedId = res?.meta?.last_row_id;
      } catch (dbErr) {
        console.warn('DB request_bayar error:', dbErr.message);
      }
    }

    // Buat URL publik foto nota agar dapat dibuka langsung via link
    const origin = new URL(c.req.url).origin;
    const notaUrl = insertedId
      ? `${origin}/api/nota/${insertedId}`
      : (dokumenPendukung && !dokumenPendukung.startsWith('data:') ? dokumenPendukung : '-');

    // 2. Kirim ke Webhook Google Sheets Realtime (jika URL dikonfigurasi)
    const GOOGLE_SHEET_WEBHOOK_URL = c.env.GOOGLE_SHEET_WEBHOOK_URL;
    let sheetSent = false;
    if (GOOGLE_SHEET_WEBHOOK_URL && GOOGLE_SHEET_WEBHOOK_URL.trim() !== '' && c.env.SHEET_SECRET_TOKEN) {
      try {
        const sheetPayload = {
          ...body,
          secretToken: c.env.SHEET_SECRET_TOKEN,
          dokumenPendukung: notaUrl
        };
        await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetPayload),
          redirect: 'follow'
        });
        sheetSent = true;
      } catch (sheetErr) {
        console.warn('Google Sheets Webhook error:', sheetErr.message);
      }
    }

    // 3. Kirim Notifikasi WhatsApp ke Finance via Wablas
    const WABLAS_TOKEN = c.env.WABLAS_TOKEN;
    const TARGET_PHONE = c.env.TARGET_PHONE;
    const WABLAS_API_URL = c.env.WABLAS_API_URL || 'https://pati.wablas.com/api/send-message';

    if (WABLAS_TOKEN && TARGET_PHONE) {
      const formattedNominal = Number(nominal).toLocaleString('id-ID');
      const waMsg = `*REQUEST PEMBAYARAN OPERASIONAL BARU*\nPerusahaan: ${pt}\nPengaju: ${namaPengaju} (${jabatan} - ${divisi})\nTanggal: ${tglPengajuan}\n\n*Detail Pembayaran:*\nVendor: ${vendor}\nBank: ${bank}\nNo Rekening / VA: ${norek}\nNama Rekening: ${namaRekening}\nNominal: *Rp ${formattedNominal}*\nMetode: ${metodeBayar}\n\n*Bukti Foto Nota:*\n${notaUrl}\n\nStatus: Pending (Mohon dicek di Google Sheets Finance). Terima kasih.`;

      fetch(WABLAS_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': WABLAS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: TARGET_PHONE,
          message: waMsg
        })
      }).catch(err => console.warn('Wablas notification error:', err.message));
    }

    return c.json({
      status: 'success',
      message: sheetSent 
        ? 'Request bayar berhasil tersimpan di Database & Google Sheets Finance!' 
        : 'Request bayar & foto nota berhasil tersimpan di sistem!',
      notaUrl: notaUrl
    });

  } catch (error) {
    return c.json({
      status: 'error',
      message: 'Gagal memproses request bayar: ' + error.message
    }, 500);
  }
});

// Endpoint View Foto Nota Pembayaran (Disajikan langsung sebagai gambar)
app.get('/api/nota/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (!c.env.DB) return c.text('Database not connected', 500);

    const row = await c.env.DB.prepare(
      'SELECT dokumen_pendukung FROM request_bayar WHERE id = ?'
    ).bind(id).first();

    if (!row || !row.dokumen_pendukung || row.dokumen_pendukung === '-') {
      return c.text('Foto nota tidak ditemukan.', 404);
    }

    const dataStr = row.dokumen_pendukung;
    if (dataStr.startsWith('data:')) {
      const parts = dataStr.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const base64 = parts[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      return new Response(bytes, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=604800'
        }
      });
    } else {
      return c.redirect(dataStr);
    }
  } catch (err) {
    return c.text('Gagal memuat foto nota: ' + err.message, 500);
  }
});

// Endpoint Verifikasi PIN GA (Membuka Formulir Request Bayar GA)
app.post('/api/verify-ga-pin', async (c) => {
  try {
    const body = await c.req.json();
    const { pin } = body;

    const pins = getConfiguredPins(c.env);
    if (!pins.ga) {
      return c.json({ status: 'error', message: 'PIN GA belum dikonfigurasi di Cloudflare.' }, 503);
    }
    if (String(pin || '').trim() === pins.ga) {
      return c.json({ status: 'success' });
    } else {
      return c.json({
        status: 'error',
        message: 'PIN GA salah! Akses ditolak.'
      }, 403);
    }
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Endpoint Verifikasi PIN Finance (Membuka Link Google Sheet Finance & Data Rekap)
app.post('/api/verify-finance-pin', async (c) => {
  try {
    const body = await c.req.json();
    const { pin } = body;

    const pins = getConfiguredPins(c.env);
    const configuredPins = Object.values(pins).filter(Boolean);
    if (configuredPins.length === 0) {
      return c.json({ status: 'error', message: 'PIN otorisasi belum dikonfigurasi di Cloudflare.' }, 503);
    }

    const inputPin = String(pin || '').trim();
    if (configuredPins.includes(inputPin)) {
      const sheetUrl = c.env.GOOGLE_SHEET_URL || '';
      
      let items = [];
      if (c.env.DB) {
        const { results } = await c.env.DB.prepare(`
          SELECT id, pt, nama_pengaju, wa_pengaju, jabatan, divisi, tgl_pengajuan, vendor, bank, norek, nama_rekening, nominal, metode_bayar, status_bayar, created_at 
          FROM request_bayar 
          ORDER BY id DESC
        `).all();
        items = results || [];
      }

      return c.json({
        status: 'success',
        sheetUrl: sheetUrl,
        data: items
      });
    } else {
      return c.json({
        status: 'error',
        message: 'PIN Finance salah! Akses ditolak.'
      }, 403);
    }
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Endpoint Ubah Status Bayar (Pending -> Sudah Dibayar)
app.post('/api/update-status-bayar', async (c) => {
  try {
    const body = await c.req.json();
    const { id, status, pin } = body;

    const pins = getConfiguredPins(c.env);
    const configuredPins = Object.values(pins).filter(Boolean);
    if (configuredPins.length === 0) {
      return c.json({ status: 'error', message: 'PIN otorisasi belum dikonfigurasi di Cloudflare.' }, 503);
    }

    const inputPin = String(pin || '').trim();
    if (!configuredPins.includes(inputPin)) {
      return c.json({ status: 'error', message: 'PIN Otorisasi salah!' }, 403);
    }

    if (c.env.DB) {
      await c.env.DB.prepare(`UPDATE request_bayar SET status_bayar = ? WHERE id = ?`).bind(status, id).run();
    }

    return c.json({ status: 'success', message: `Status pembayaran ID #${id} berhasil diubah menjadi "${status}"` });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Endpoint Monitoring Request Bayar (Untuk Tim Finance)
app.get('/api/monitoring-bayar', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json([]);
    }
    const { results } = await c.env.DB.prepare("SELECT * FROM request_bayar ORDER BY id DESC").all();
    return c.json(results || []);
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// ==========================================
// 4. MODUL STOCK OPNAME ATK MULTI-PT
// ==========================================

const defaultAtkItems = [
  { id: '1', company: 'PT SANPOTA BATARA INDONESIA - KANTOR GWR', name: 'Kertas A4 70gr', system_stock: 20, physical_stock: 20, min_threshold: 5, unit: 'Rim', last_updated_by: 'Sistem' },
  { id: '2', company: 'PT SANPOTA BATARA INDONESIA - KANTOR GWR', name: 'Pulpen Pilot Black', system_stock: 8, physical_stock: 8, min_threshold: 5, unit: 'Pcs', last_updated_by: 'Sistem' },
  { id: '3', company: 'PT SANPOTA BATARA INDONESIA - KANTOR GWR', name: 'Tinta Printer Black', system_stock: 4, physical_stock: 4, min_threshold: 5, unit: 'Botol', last_updated_by: 'Sistem' },
  { id: '4', company: 'PT SANPOTA BATARA INDONESIA - WAREHOUSE BSD', name: 'Air Mineral Dus', system_stock: 2, physical_stock: 2, min_threshold: 5, unit: 'Dus', last_updated_by: 'Sistem' },
  { id: '5', company: 'PT SANPOTA BATARA INDONESIA - WAREHOUSE BSD', name: 'Sabun Cuci Tangan 5L', system_stock: 0, physical_stock: 0, min_threshold: 2, unit: 'Jerigen', last_updated_by: 'Sistem' },
  { id: '6', company: 'PT WIGUNA INTI BATARA UTAMA', name: 'Map Snelhepter', system_stock: 15, physical_stock: 15, min_threshold: 5, unit: 'Pcs', last_updated_by: 'Sistem' },
  { id: '7', company: 'PT WIGUNA INTI BATARA UTAMA', name: 'Stapler No.10', system_stock: 3, physical_stock: 3, min_threshold: 5, unit: 'Pcs', last_updated_by: 'Sistem' },
  { id: '8', company: 'PT VISCATA INSPIRASI BATARA INDONESIA', name: 'Buku Ekspedisi', system_stock: 12, physical_stock: 12, min_threshold: 5, unit: 'Buku', last_updated_by: 'Sistem' },
  { id: '9', company: 'PT VISCATA INSPIRASI BATARA INDONESIA', name: 'Lakban Bening 2 Inch', system_stock: 1, physical_stock: 1, min_threshold: 5, unit: 'Roll', last_updated_by: 'Sistem' }
];

// GET Data Inventory ATK
app.get('/api/inventory', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ status: 'success', data: defaultAtkItems });
    }

    let { results } = await c.env.DB.prepare("SELECT * FROM inventory_atk ORDER BY CAST(id AS INTEGER) ASC").all();

    // Auto-seed default data jika tabel masih kosong
    if (!results || results.length === 0) {
      for (const item of defaultAtkItems) {
        await c.env.DB.prepare(`
          INSERT INTO inventory_atk (id, company, name, system_stock, physical_stock, min_threshold, unit, last_updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(item.id, item.company, item.name, item.system_stock, item.physical_stock, item.min_threshold, item.unit, item.last_updated_by).run();
      }
      const seeded = await c.env.DB.prepare("SELECT * FROM inventory_atk ORDER BY CAST(id AS INTEGER) ASC").all();
      results = seeded.results || [];
    }

    return c.json({ status: 'success', data: results });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// GET 5 History Terakhir
app.get('/api/inventory/history', async (c) => {
  try {
    if (!c.env.DB) return c.json({ status: 'success', data: [] });
    const { results } = await c.env.DB.prepare("SELECT * FROM inventory_history ORDER BY id DESC LIMIT 5").all();
    return c.json({ status: 'success', data: results || [] });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// POST Aksi Inventory (take, add, opname)
app.post('/api/inventory/action', async (c) => {
  try {
    const body = await c.req.json();
    const { id, action, qty, userName } = body;
    if (!id || !action || !userName) {
      return c.json({ status: 'error', message: 'Data tidak lengkap.' }, 400);
    }

    if (!c.env.DB) return c.json({ status: 'error', message: 'Database D1 belum aktif.' }, 500);

    const item = await c.env.DB.prepare("SELECT * FROM inventory_atk WHERE id = ?").bind(id).first();
    if (!item) return c.json({ status: 'error', message: 'Barang tidak ditemukan.' }, 404);

    let newPhysical = item.physical_stock;
    let newSystem = item.system_stock;
    let logAction = '';

    if (action === 'take') {
      const takeQty = parseInt(qty) || 0;
      if (takeQty > item.physical_stock) {
        return c.json({ status: 'error', message: 'Pengambilan melebihi stok fisik tersedia!' }, 400);
      }
      newPhysical -= takeQty;
      newSystem -= takeQty;
      logAction = `Mengambil ${takeQty} ${item.unit} ${item.name}`;
    } else if (action === 'add') {
      const addQty = parseInt(qty) || 0;
      newPhysical += addQty;
      newSystem += addQty;
      logAction = `Menambah stok +${addQty} ${item.unit} ${item.name}`;
    } else if (action === 'opname') {
      const opnameQty = parseInt(qty) || 0;
      const prev = item.physical_stock;
      newPhysical = opnameQty;
      newSystem = opnameQty;
      logAction = `Opname ${item.name}: penyesuaian dari ${prev} ke ${opnameQty} ${item.unit}`;
    } else {
      return c.json({ status: 'error', message: 'Aksi tidak valid.' }, 400);
    }

    await c.env.DB.prepare(`
      UPDATE inventory_atk 
      SET physical_stock = ?, system_stock = ?, last_updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newPhysical, newSystem, userName, id).run();

    await c.env.DB.prepare(`
      INSERT INTO inventory_history (user_name, action_text) VALUES (?, ?)
    `).bind(userName, logAction).run();

    return c.json({ 
      status: 'success', 
      message: logAction, 
      physical_stock: newPhysical, 
      system_stock: newSystem 
    });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// POST Tambah Barang Baru
app.post('/api/inventory/add-item', async (c) => {
  try {
    const body = await c.req.json();
    const { company, name, stock, minThreshold, unit, userName } = body;
    if (!company || !name || !unit || !userName) {
      return c.json({ status: 'error', message: 'Mohon lengkapi semua kolom!' }, 400);
    }

    const newItemId = Date.now().toString();
    const initialStock = parseInt(stock) || 0;
    const minThresh = parseInt(minThreshold) || 5;

    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT INTO inventory_atk (id, company, name, system_stock, physical_stock, min_threshold, unit, last_updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(newItemId, company, name, initialStock, initialStock, minThresh, unit, userName).run();

      await c.env.DB.prepare(`
        INSERT INTO inventory_history (user_name, action_text) VALUES (?, ?)
      `).bind(userName, `Menambah barang baru: ${name} (${initialStock} ${unit})`).run();
    }

    return c.json({ 
      status: 'success', 
      message: `Barang ${name} berhasil ditambahkan!`, 
      id: newItemId 
    });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// POST Hapus Barang (Salah Input / Buang Barang ATK)
app.post('/api/inventory/delete', async (c) => {
  try {
    const body = await c.req.json();
    const { id, userName } = body;
    if (!id) {
      return c.json({ status: 'error', message: 'ID barang tidak valid.' }, 400);
    }

    if (!c.env.DB) return c.json({ status: 'error', message: 'Database D1 belum aktif.' }, 500);

    const item = await c.env.DB.prepare("SELECT * FROM inventory_atk WHERE id = ?").bind(id).first();
    if (!item) {
      return c.json({ status: 'error', message: 'Barang tidak ditemukan.' }, 404);
    }

    await c.env.DB.prepare("DELETE FROM inventory_atk WHERE id = ?").bind(id).run();

    const actor = userName || 'Admin GA';
    await c.env.DB.prepare(`
      INSERT INTO inventory_history (user_name, action_text) VALUES (?, ?)
    `).bind(actor, `Menghapus barang: ${item.name} (${item.company})`).run();

    return c.json({ 
      status: 'success', 
      message: `Barang "${item.name}" berhasil dihapus dari sistem!` 
    });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// Proxy Kirim Wablas Laporan Re-Order ATK (Bypass CORS)
app.post('/api/send-wablas', async (c) => {
  try {
    const body = await c.req.json();
    const { message } = body;
    const WABLAS_TOKEN = c.env.WABLAS_TOKEN;
    const WABLAS_API_URL = c.env.WABLAS_API_URL || 'https://pati.wablas.com/api/send-message';
    const targetPhone = c.env.TARGET_PHONE;

    if (!WABLAS_TOKEN || !targetPhone) {
      return c.json({ status: 'error', message: 'Secret WABLAS_TOKEN dan TARGET_PHONE harus disetting di Cloudflare.' }, 500);
    }

    const res = await fetch(WABLAS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': WABLAS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: targetPhone,
        message: message
      })
    });

    const resJson = await res.json().catch(() => ({}));
    return c.json({ status: 'success', data: resJson });
  } catch (error) {
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

export default app;
