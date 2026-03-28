-- ═══════════════════════════════════════════════════════════════════
-- HMCS 0.01.5 — Workers Migration + Test Data Cleanup
-- Ejecutar en psql: psql -U postgres -d hmcs_db -f migration_workers.sql
-- ═══════════════════════════════════════════════════════════════════

-- PASO 1: Agregar columna deleted_at a la tabla workers
-- (Es idempotente: no falla si ya existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workers' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE workers ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
        RAISE NOTICE 'Columna deleted_at agregada correctamente.';
    ELSE
        RAISE NOTICE 'La columna deleted_at ya existe. Sin cambios.';
    END IF;
END
$$;

-- PASO 2: Ver workers inactivos antes de borrar (para confirmar)
SELECT 
    w.id, 
    w.first_name, 
    w.last_name, 
    w.worker_code, 
    w.status, 
    w.is_active, 
    w.user_id,
    u.email
FROM workers w
LEFT JOIN users u ON u.id = w.user_id
WHERE w.is_active = false OR w.status = 'inactive'
ORDER BY w.id;

-- ─── Si los resultados son los perfiles de prueba, ejecutar PASO 3 ───

-- PASO 3: Verificar que no tienen datos vinculados antes de borrar
SELECT 
    'RZ-2854' as code,
    (SELECT COUNT(*) FROM time_entries   WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'RZ-2854')) AS time_entries,
    (SELECT COUNT(*) FROM assignments    WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'RZ-2854')) AS assignments,
    (SELECT COUNT(*) FROM invoice_lines  WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'RZ-2854')) AS invoice_lines,
    (SELECT COUNT(*) FROM payroll_lines  WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'RZ-2854')) AS payroll_lines
UNION ALL
SELECT 
    'HF-6085' as code,
    (SELECT COUNT(*) FROM time_entries   WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'HF-6085')) AS time_entries,
    (SELECT COUNT(*) FROM assignments    WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'HF-6085')) AS assignments,
    (SELECT COUNT(*) FROM invoice_lines  WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'HF-6085')) AS invoice_lines,
    (SELECT COUNT(*) FROM payroll_lines  WHERE worker_id = (SELECT id FROM workers WHERE worker_code = 'HF-6085')) AS payroll_lines;

-- ─── Si todos los conteos son 0, ejecutar PASO 4 ───

-- PASO 4: Borrar workers de prueba (hard delete)
-- El orden importa: primero workers, luego users (sin dependencias)

BEGIN;

-- Guardar los user_ids antes de borrar workers
DO $$
DECLARE
    uid_rz INTEGER;
    uid_hf INTEGER;
BEGIN
    SELECT user_id INTO uid_rz FROM workers WHERE worker_code = 'RZ-2854';
    SELECT user_id INTO uid_hf FROM workers WHERE worker_code = 'HF-6085';

    -- Borrar workers
    DELETE FROM workers WHERE worker_code IN ('RZ-2854', 'HF-6085');
    RAISE NOTICE 'Workers RZ-2854 y HF-6085 eliminados.';

    -- Borrar sus users asociados (liberar emails)
    IF uid_rz IS NOT NULL THEN
        DELETE FROM users WHERE id = uid_rz;
        RAISE NOTICE 'Usuario de RZ-2854 eliminado (id: %).', uid_rz;
    END IF;
    IF uid_hf IS NOT NULL THEN
        DELETE FROM users WHERE id = uid_hf;
        RAISE NOTICE 'Usuario de HF-6085 eliminado (id: %).', uid_hf;
    END IF;
END
$$;

COMMIT;

-- PASO 5: Verificar estado final
SELECT 
    w.id, 
    w.first_name || ' ' || w.last_name AS nombre,
    w.worker_code, 
    w.status, 
    w.is_active,
    u.email
FROM workers w
LEFT JOIN users u ON u.id = w.user_id
ORDER BY w.first_name;
