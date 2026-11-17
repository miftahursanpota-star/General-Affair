CREATE TABLE IF NOT EXISTS pengajuan_barang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pt TEXT NOT NULL,
    tgl_pengajuan TEXT NOT NULL,
    pemohon TEXT NOT NULL,
    nama_barang TEXT NOT NULL,
    qty INTEGER NOT NULL,
    harga_satuan TEXT NOT NULL,
    total_estimasi TEXT NOT NULL,
    supplier TEXT NOT NULL,
    keperluan TEXT NOT NULL,
    tgl_dibutuhkan TEXT NOT NULL,
    lampiran TEXT,
    status_acc TEXT DEFAULT 'Requested',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_bayar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pt TEXT NOT NULL,
    nama_pengaju TEXT NOT NULL,
    wa_pengaju TEXT NOT NULL,
    jabatan TEXT NOT NULL,
    divisi TEXT NOT NULL,
    tgl_pengajuan TEXT NOT NULL,
    vendor TEXT NOT NULL,
    bank TEXT NOT NULL,
    norek TEXT NOT NULL,
    nama_rekening TEXT NOT NULL,
    nominal INTEGER NOT NULL,
    metode_bayar TEXT NOT NULL,
    dokumen_pendukung TEXT,
    status_bayar TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_atk (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    name TEXT NOT NULL,
    system_stock INTEGER NOT NULL,
    physical_stock INTEGER NOT NULL,
    min_threshold INTEGER NOT NULL,
    unit TEXT NOT NULL,
    last_updated_by TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    action_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS perbaikan_aset (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pt TEXT NOT NULL,
    nama_pengaju TEXT NOT NULL,
    nik TEXT,
    jabatan TEXT NOT NULL,
    divisi TEXT NOT NULL,
    atasan_langsung TEXT,
    wa_pengaju TEXT NOT NULL,
    nama_aset TEXT NOT NULL,
    merk_tipe TEXT,
    nomor_seri TEXT,
    kode_inventaris TEXT,
    qty INTEGER DEFAULT 1,
    kelengkapan TEXT,
    jenis_kerusakan TEXT NOT NULL,
    tgl_kejadian TEXT NOT NULL,
    deskripsi_masalah TEXT NOT NULL,
    keterangan TEXT,
    foto_kerusakan TEXT,
    status_acc TEXT DEFAULT 'Requested',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
