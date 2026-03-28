-- ═══════════════════════════════════════════════════════════════════
-- HMCS 0.01.5 — Clients Migration (deleted_at) 
-- Ejecutar en psql: psql -U postgres -d hmcs_db -f migration_clients.sql
-- ═══════════════════════════════════════════════════════════════════

-- PASO 1: Agregar deleted_at a la tabla clients
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE clients ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
        RAISE NOTICE 'Columna deleted_at agregada a clients.';
    ELSE
        RAISE NOTICE 'deleted_at ya existe en clients. Sin cambios.';
    END IF;
END
$$;

-- PASO 2: Verificar estado actual de clientes
SELECT id, company_name, status, is_active
FROM clients
ORDER BY company_name;
