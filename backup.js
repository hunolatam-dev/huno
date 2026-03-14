const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLAS = [
  'clientes',
  'rrhh',
  'ddjj_state',
  'facturas',
  'at2026_facturas',
  'at2026_abonos',
  'cartola_movimientos',
  'cartola_cuentas',
  'conciliaciones',
  'activity_log',
  'personal',
  'notificaciones',
];

async function backup() {
  const now = new Date();
  const fecha = now.toISOString().slice(0, 10);
  const hora  = now.toISOString().slice(11, 16).replace(':', '-');
  const carpeta = path.join('backups', fecha);

  fs.mkdirSync(carpeta, { recursive: true });

  const resumen = { fecha: now.toISOString(), tablas: {}, total_registros: 0, errores: [] };

  console.log('HUNO Backup — ' + fecha + ' ' + hora);
  console.log('='.repeat(45));

  for (const tabla of TABLAS) {
    try {
      let allData = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await sb.from(tabla).select('*').range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const archivo = path.join(carpeta, tabla + '.json');
      fs.writeFileSync(archivo, JSON.stringify({ tabla, fecha_backup: now.toISOString(), total: allData.length, datos: allData }, null, 2), 'utf-8');
      resumen.tablas[tabla] = { registros: allData.length, ok: true };
      resumen.total_registros += allData.length;
      console.log('OK  ' + tabla.padEnd(25) + allData.length + ' registros');
    } catch (err) {
      const msg = err.message || String(err);
      resumen.tablas[tabla] = { ok: false, error: msg };
      resumen.errores.push(tabla + ': ' + msg);
      console.log('--  ' + tabla.padEnd(25) + '(no existe o sin acceso)');
    }
  }

  fs.writeFileSync(path.join(carpeta, '_resumen.json'), JSON.stringify(resumen, null, 2), 'utf-8');

  // Actualizar indice sin eliminar nada
  const indiceArchivo = path.join('backups', 'indice.json');
  let indice = [];
  if (fs.existsSync(indiceArchivo)) {
    try { indice = JSON.parse(fs.readFileSync(indiceArchivo, 'utf-8')); } catch(e) {}
  }
  indice.unshift({ fecha, hora: hora.replace('-',':'), total_registros: resumen.total_registros, errores: resumen.errores.length });
  fs.writeFileSync(indiceArchivo, JSON.stringify(indice, null, 2), 'utf-8');

  console.log('='.repeat(45));
  console.log('Backup completo: ' + resumen.total_registros + ' registros');
}

backup().catch(err => { console.error('Error:', err); process.exit(1); });
