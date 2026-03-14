# 🗄️ Backups — HUNO® Sistema

Backups automáticos de Supabase generados por GitHub Actions.

## Estructura
```
backups/
  indice.json          ← Lista de todos los backups
  2026-03-14/
    _resumen.json      ← Resumen del backup del día
    clientes.json
    rrhh.json
    ddjj_state.json    ← MÁS CRÍTICO
    facturas.json
    at2026_facturas.json
    at2026_abonos.json
    cartola_movimientos.json
    ...
```

## Horario
- Automático: todos los días a las **03:00 AM hora Chile**
- Manual: desde GitHub Actions → Run workflow

## Retención
- Se conservan los últimos **30 días** de backups
- El índice mantiene registro de los últimos **90 días**

## Restaurar datos
Para restaurar, toma el archivo `.json` del día que necesitas
y usa el Supabase SQL Editor o la API para reinsertar los datos.
