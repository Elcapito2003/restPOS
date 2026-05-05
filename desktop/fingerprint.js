// Bridge nativo Electron <-> ZKFinger SDK (libzkfp.dll).
// El driver + DLLs de runtime los instala el setup.exe del SDK que el admin
// corre una vez por PC. libzkfp.dll vive en C:\Windows\System32 y Windows
// la resuelve sola por nombre.

const { ipcMain } = require('electron');

const MAX_TEMPLATE_SIZE = 2048;

let koffi = null;
let lib = null;
let fns = null;        // Funciones cacheadas
let device = null;     // HANDLE del lector
let dbCache = null;    // HANDLE del cache de matching
let initialized = false;

function tryLoad() {
  if (lib) return true;
  try {
    koffi = require('koffi');
    // Intentar cargar; en x64 Windows, libzkfp.dll vive en System32.
    // koffi resuelve por PATH/System32 automáticamente.
    lib = koffi.load('libzkfp.dll');

    fns = {
      Init:            lib.func('int __stdcall ZKFPM_Init()'),
      Terminate:       lib.func('int __stdcall ZKFPM_Terminate()'),
      GetDeviceCount:  lib.func('int __stdcall ZKFPM_GetDeviceCount()'),
      OpenDevice:      lib.func('void* __stdcall ZKFPM_OpenDevice(int)'),
      CloseDevice:     lib.func('int __stdcall ZKFPM_CloseDevice(void*)'),
      AcquireFingerprint: lib.func(
        'int __stdcall ZKFPM_AcquireFingerprint(void* hDevice, _Out_ uint8_t* fpImage, unsigned int cbFPImage, _Out_ uint8_t* fpTemplate, _Inout_ unsigned int* cbTemplate)'
      ),
      DBInit:          lib.func('void* __stdcall ZKFPM_DBInit()'),
      DBFree:          lib.func('int __stdcall ZKFPM_DBFree(void*)'),
      DBMerge:         lib.func(
        'int __stdcall ZKFPM_DBMerge(void* hDB, uint8_t* t1, uint8_t* t2, uint8_t* t3, _Out_ uint8_t* regTemp, _Inout_ unsigned int* cbRegTemp)'
      ),
      DBAdd:           lib.func('int __stdcall ZKFPM_DBAdd(void* hDB, unsigned int fid, uint8_t* fpTemplate, unsigned int cbTemplate)'),
      DBDel:           lib.func('int __stdcall ZKFPM_DBDel(void* hDB, unsigned int fid)'),
      DBClear:         lib.func('int __stdcall ZKFPM_DBClear(void*)'),
      DBCount:         lib.func('int __stdcall ZKFPM_DBCount(void*, _Out_ unsigned int* fpCount)'),
      DBIdentify:      lib.func(
        'int __stdcall ZKFPM_DBIdentify(void* hDB, uint8_t* fpTemplate, unsigned int cbTemplate, _Out_ unsigned int* fid, _Out_ unsigned int* score)'
      ),
      DBMatch:         lib.func(
        'int __stdcall ZKFPM_DBMatch(void* hDB, uint8_t* t1, unsigned int cb1, uint8_t* t2, unsigned int cb2)'
      ),
      GetCaptureParamsEx: lib.func(
        'int __stdcall ZKFPM_GetCaptureParamsEx(void* hDevice, _Out_ int* width, _Out_ int* height, _Out_ int* dpi)'
      ),
    };
    return true;
  } catch (err) {
    console.error('[fingerprint] no se pudo cargar libzkfp.dll:', err.message);
    lib = null;
    fns = null;
    return false;
  }
}

function ensureInit() {
  if (!tryLoad()) throw new Error('libzkfp.dll no disponible. Instala el SDK ZKFinger en esta PC.');
  if (!initialized) {
    const r = fns.Init();
    if (r !== 0) throw new Error(`ZKFPM_Init falló: código ${r}`);
    initialized = true;
  }
}

function openDevice() {
  ensureInit();
  if (device) return device;
  const count = fns.GetDeviceCount();
  if (count <= 0) throw new Error('No hay lector de huella conectado');
  const h = fns.OpenDevice(0);
  if (!h) throw new Error('No se pudo abrir el lector (índice 0)');
  device = h;
  // Crear DB cache para matching
  if (!dbCache) {
    const c = fns.DBInit();
    if (!c) throw new Error('No se pudo inicializar el cache de matching');
    dbCache = c;
  }
  return device;
}

function ensureDbCache() {
  if (!dbCache) {
    ensureInit();
    const c = fns.DBInit();
    if (!c) throw new Error('No se pudo inicializar el cache de matching');
    dbCache = c;
  }
  return dbCache;
}

function closeAll() {
  try { if (dbCache) { fns.DBFree(dbCache); dbCache = null; } } catch {}
  try { if (device) { fns.CloseDevice(device); device = null; } } catch {}
  try { if (initialized) { fns.Terminate(); initialized = false; } } catch {}
}

function captureOnce() {
  openDevice();
  const widthBuf = [0], heightBuf = [0], dpiBuf = [0];
  fns.GetCaptureParamsEx(device, widthBuf, heightBuf, dpiBuf);
  const imgSize = (widthBuf[0] || 300) * (heightBuf[0] || 400);
  const img = Buffer.alloc(imgSize);
  const tmpl = Buffer.alloc(MAX_TEMPLATE_SIZE);
  const tmplLen = [MAX_TEMPLATE_SIZE];
  const r = fns.AcquireFingerprint(device, img, imgSize, tmpl, tmplLen);
  if (r !== 0) return { ok: false, code: r };
  return { ok: true, template: tmpl.subarray(0, tmplLen[0]) };
}

// Captura con polling — espera hasta `timeoutMs` a que el usuario ponga el dedo.
async function captureBlocking(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = captureOnce();
    if (r.ok) return r.template.toString('base64');
    // Códigos típicos: -8 (no finger), -17 (capture in progress), reintentar
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Tiempo de espera agotado (no se detectó dedo)');
}

function mergeTemplates(t1Base64, t2Base64, t3Base64) {
  ensureDbCache();
  const t1 = Buffer.from(t1Base64, 'base64');
  const t2 = Buffer.from(t2Base64, 'base64');
  const t3 = Buffer.from(t3Base64, 'base64');
  const reg = Buffer.alloc(MAX_TEMPLATE_SIZE);
  const regLen = [MAX_TEMPLATE_SIZE];
  const r = fns.DBMerge(dbCache, t1, t2, t3, reg, regLen);
  if (r !== 0) throw new Error(`Merge de templates falló: código ${r}`);
  return reg.subarray(0, regLen[0]).toString('base64');
}

function identify(templates, capturedBase64) {
  // Reconstruir cache con los templates conocidos y hacer 1:N
  ensureDbCache();
  fns.DBClear(dbCache);
  for (const { fid, template } of templates) {
    const buf = Buffer.from(template, 'base64');
    fns.DBAdd(dbCache, fid, buf, buf.length);
  }
  const cap = Buffer.from(capturedBase64, 'base64');
  const fidOut = [0];
  const scoreOut = [0];
  const r = fns.DBIdentify(dbCache, cap, cap.length, fidOut, scoreOut);
  if (r === 0) return { matched: true, fid: fidOut[0], score: scoreOut[0] };
  return { matched: false, code: r };
}

function setupHandlers() {
  ipcMain.handle('fingerprint:available', () => tryLoad());

  ipcMain.handle('fingerprint:device-info', () => {
    try {
      ensureInit();
      const count = fns.GetDeviceCount();
      return { available: true, count };
    } catch (err) {
      return { available: false, error: err.message };
    }
  });

  ipcMain.handle('fingerprint:capture', async (_e, timeoutMs) => {
    try {
      const tmpl = await captureBlocking(timeoutMs || 10000);
      return { ok: true, template: tmpl };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('fingerprint:merge', (_e, t1, t2, t3) => {
    try {
      const reg = mergeTemplates(t1, t2, t3);
      return { ok: true, template: reg };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('fingerprint:identify', (_e, payload) => {
    try {
      const { templates, captured } = payload || {};
      if (!Array.isArray(templates) || !captured) return { ok: false, error: 'payload inválido' };
      return { ok: true, ...identify(templates, captured) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('fingerprint:close', () => { closeAll(); return { ok: true }; });
}

module.exports = { setupHandlers, closeAll };
