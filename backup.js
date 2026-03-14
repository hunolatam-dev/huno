// ============================================================
// HUNO® — Backup automático de Supabase
// Se ejecuta via GitHub Actions cada día a las 03:00 AM Chile
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno SUPABASE_URL y SUPABASE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tablas a respaldar en orden de prioridad
const TABLAS = [
  { nombre: 'clientes',            desc: 'Estado y datos de clientes' },
  { nombre: 'rrhh',                desc: 'Checks RRHH y Previred' },
  { nombre: 'ddjj_state',          desc: 'DDJJ asignadas y checks AT2026' },
  { nombre: 'facturas',            desc: 'Facturas emitidas por cliente' },
  { nombre: 'at2026_facturas',     desc: 'Facturas AT2026' },
  { nombre: 'at2026_abonos',       desc: 'Abonos de facturas AT2026' },
  { nombre: 'cartola_movimientos', desc: 'Movimientos de cartola bancaria' },
  { nombre: 'cartola_cuentas',     desc: 'Cuentas bancarias registradas' },
  { nombre: 'conciliaciones',      desc: 'Conciliaciones bancarias' },
  { nombre: 'activity_log',        desc: 'Historial de actividad' },
  { nombre: 'personal',            desc: 'Usuarios del sistema' },
  { nombre: 'notificaciones',      desc: 'Notificaciones' },
];

async function backup() {
  const now = new Date();
  const fecha = now.toISOString().slice(0, 10);         // 2026-03-14
  const hora  = now.toISOString().slice(11, 19).replace(/:/g, '-'); // 06-00-00
  const carpeta = path.join('backups', fecha);

  // Crear carpeta del día
  fs.mkdirSync(carpeta, { recursive: true });

  const resumen = {
    fecha: now.toISOString(),
    tablas: {},
    total_registros: 0,
    errores: []
  };

  console.log(`\n🗄️  HUNO® Backup — ${fecha} ${hora}`);
  console.log('='.repeat(50));

  for (const tabla of TABLAS) {
    try {
      // Leer todos los registros (paginado para tablas grandes)
      let allData = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await sb
          .from(tabla.nombre)
          .select('*')
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Guardar JSON
      const archivo = path.join(carpeta, `${tabla.nombre}.json`);
      fs.writeFileSync(archivo, JSON.stringify({
        tabla: tabla.nombre,
        descripcion: tabla.desc,
        fecha_backup: now.toISOString(),
        total: allData.length,
        datos: allData
      }, null, 2), 'utf-8');

      resumen.tablas[tabla.nombre] = { registros: allData.length, ok: true };
      resumen.total_registros += allData.length;
      console.log(`  ✅ ${tabla.nombre.padEnd(25)} ${allData.length} registros`);

    } catch (err) {
      const msg = err.message || String(err);
      resumen.tablas[tabla.nombre] = { ok: false, error: msg };
      resumen.errores.push(`${tabla.nombre}: ${msg}`);
      console.log(`  ⚠️  ${tabla.nombre.padEnd(25)} ${msg.includes('does not exist') ? 'tabla no existe (ok)' : msg}`);
    }
  }

  // Guardar resumen del backup
  const resumenArchivo = path.join(carpeta, '_resumen.json');
  fs.writeFileSync(resumenArchivo, JSON.stringify(resumen, null, 2), 'utf-8');

  // Actualizar índice general de backups
  const indiceArchivo = path.join('backups', 'indice.json');
  let indice = [];
  if (fs.existsSync(indiceArchivo)) {
    try { indice = JSON.parse(fs.readFileSync(indiceArchivo, 'utf-8')); } catch(e) {}
  }

  // Agregar entrada al índice
  indice.unshift({
    fecha,
    hora: hora.replace(/-/g, ':'),
    total_registros: resumen.total_registros,
    tablas_ok: Object.values(resumen.tablas).filter(t => t.ok).length,
    errores: resumen.errores.length,
    carpeta: carpeta
  });

  // Mantener solo los últimos 90 días en el índice
  if (indice.length > 90) indice = indice.slice(0, 90);
  fs.writeFileSync(indiceArchivo, JSON.stringify(indice, null, 2), 'utf-8');

  // Limpiar backups antiguos (más de 30 días)
  const treintaDias = new Date(now);
  treintaDias.setDate(treintaDias.getDate() - 30);
  const backupsDir = 'backups';
  if (fs.existsSync(backupsDir)) {
    fs.readdirSync(backupsDir).forEach(dir => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dir)) {
        const dirDate = new Date(dir);
        if (dirDate < treintaDias) {
          fs.rmSync(path.join(backupsDir, dir), { recursive: true });
          console.log(`  🗑️  Backup antiguo eliminado: ${dir}`);
        }
      }
    });
  }

  console.log('='.repeat(50));
  console.log(`✅ Backup completado: ${resumen.total_registros} registros totales`);
  if (resumen.errores.length > 0) {
    console.log(`⚠️  ${resumen.errores.length} advertencias (tablas no existentes)`);
  }

  process.exit(0);
}

backup().catch(err => {
  console.error('❌ Error crítico en backup:', err);
  process.exit(1);
});
