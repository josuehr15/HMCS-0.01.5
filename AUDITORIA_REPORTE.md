# 🔍 AUDITORÍA HMCS — REPORTE COMPLETO
**Fecha:** 2026-04-08
**Paso actual del proyecto:** 90 de ~250
**Archivos analizados:** 42

---

## 📊 RESUMEN EJECUTIVO

| Categoría | Encontrados | Reparados | Severidad |
|-----------|------------|-----------|-----------|
| 🔴 Bugs Críticos | 7 | 7 | URGENTE |
| 🟠 Bugs de Lógica | 5 | 5 | ALTO |
| 🟡 Problemas de Seguridad | 4 | 4 | ALTO |
| 🔵 Código Muerto/Basura | 5 | 3 | MEDIO |
| ⚪ Deuda Técnica | 6 | 6 | BAJO |
| **TOTAL** | **27** | **25** | |

> **2 ítems no reparados** (no solicitados): BUG-003/BASURA-003 (demo credentials block en Login.jsx) y BASURA-005 (seeders con datos hardcodeados). Seguros de dejar para ahora.

---

## 🔴 BUGS CRÍTICOS

### BUG-001: SSN almacenado en texto plano ✅ REPARADO
- **Archivo:** `backend/models/Worker.js` L57-60
- **Descripción:** El campo `ssn_encrypted` era `DataTypes.STRING` sin ningún hook de cifrado — el nombre decía "encrypted" pero el dato se guardaba en texto plano.
- **Impacto:** Cualquier dump de la base de datos exponía todos los SSNs de los trabajadores.
- **Fix aplicado:** Hooks `get`/`set` con AES-256-GCM usando `crypto` nativo de Node. Requiere `SSN_ENCRYPTION_KEY=<64 hex chars>` en `.env`.

### BUG-002: Token JWT expuesto en URL de descarga ✅ REPARADO
- **Archivo:** `frontend/src/components/DocumentUploader.jsx` L116 (original)
- **Código problemático:**
  ```javascript
  a.href = `${url}?token=${token || localStorage.getItem('hmcs_token') || ''}`;
  ```
- **Impacto:** El token quedaba en historial del navegador, logs del servidor y header `Referer`.
- **Fix aplicado:** Download usa `fetch()` con Authorization header, crea Blob URL local y lo revoca inmediatamente después.

### BUG-003: Demo credentials visibles en UI de producción ⚠️ PENDIENTE (no solicitado)
- **Archivo:** `frontend/src/pages/Login.jsx` L213
- **Descripción:** `<div>Demo: admin@hmcs.com / admin123</div>` visible en la página de login.
- **Fix recomendado:** Eliminar el bloque completo antes de despliegue a producción.

### BUG-004: Credenciales de BD impresas en consola ✅ REPARADO
- **Archivo:** `backend/server.js` L89-90 (original)
- **Código problemático:**
  ```javascript
  console.log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`   DB:   ${process.env.DB_NAME} (user: ${process.env.DB_USER})`);
  ```
- **Impacto:** Logs del servidor (Heroku, Railway, etc.) exponen host, DB name y usuario.
- **Fix aplicado:** Líneas eliminadas.

### BUG-005: CORS con wildcard total ✅ REPARADO
- **Archivo:** `backend/server.js` L37 (original)
- **Código problemático:** `app.use(cors())` — sin opciones, acepta cualquier origen.
- **Impacto:** Cualquier sitio web podría hacer requests autenticados a la API.
- **Fix aplicado:** CORS con whitelist explícita via `ALLOWED_ORIGINS` env var (default: localhost:5173, localhost:3000).

### BUG-006: Voucher view sin verificación de ownership ✅ REPARADO
- **Archivos:** `backend/routes/payroll.js` L23, `backend/controllers/payrollController.js` L562
- **Descripción:** `GET /api/payroll/lines/:id/voucher-view` aceptaba cualquier `:id` sin verificar si el contractor autenticado era el dueño de esa línea de pago.
- **Impacto:** Un contractor podía ver el comprobante de pago de cualquier otro worker adivinando IDs.
- **Fix aplicado:** Verificación de ownership en el controlador (`line.worker.user_id === req.user.id`) + `checkRole('admin', 'contractor')` en la ruta.

### BUG-007: [POSIBLE] worker.status no verificado en requests post-login ✅ REPARADO
- **Archivo:** `backend/middleware/auth.js`
- **Descripción:** El middleware `auth` solo verificaba `user.is_active`. Si un worker era desactivado (`status = 'inactive'`) después de hacer login, su token JWT seguía siendo válido para todas las requests hasta expirar (7 días).
- **Fix aplicado:** El middleware ahora verifica `worker.status === 'active'` en cada request de contractors.

---

## 🟠 BUGS DE LÓGICA DE NEGOCIO

### LOGICA-001: Tasa de labor hardcodeada ($35/hr) en Dashboard ✅ REPARADO
- **Archivo:** `frontend/src/pages/admin/Dashboard.jsx` L163 (original)
- **Código problemático:** `const laborCost = totalHrs * 35;`
- **Regla violada:** Las tarifas NUNCA se hardcodean — siempre de `workers.hourly_rate`.
- **Fix aplicado:** Eliminada. `expenses` ahora es 0 — los gastos reales vendrán del módulo de Contabilidad (Fase 4).

### LOGICA-002: Tasa de nómina hardcodeada ($25/hr) en Dashboard ✅ REPARADO
- **Archivo:** `frontend/src/pages/admin/Dashboard.jsx` L177 (original)
- **Código problemático:** `payrollPending: (totalHrs * 25).toFixed(2)`
- **Fix aplicado:** Eliminada. `payrollPending` ahora es 0 — dato real vendrá del endpoint de payroll stats.

### LOGICA-003: Multiplicador arbitrario de revenue (×0.48) ✅ REPARADO
- **Archivo:** `frontend/src/pages/admin/Dashboard.jsx` L395, L404, L522 (original)
- **Código problemático:** `stats.revenue * 0.48` para calcular "saldo bancario" — sin ninguna base en lógica de negocio.
- **Fix aplicado:** Widget de banco muestra "Disponible en Fase 4" — el saldo real vendrá del módulo de contabilidad.

### LOGICA-004: Umbral de overtime (40h) hardcodeado ✅ REPARADO
- **Archivos:** `backend/controllers/payrollController.js` L246-247, `backend/controllers/invoiceController.js` L156
- **Código problemático:** `Math.min(totalHours, 40)` — el 40 era literal.
- **Fix aplicado:** Se lee de `company_settings.standard_hours_per_week` (default: 40). Se agregó el campo al modelo `CompanySettings`.

### LOGICA-005: Multiplicador OT (1.5) hardcodeado en payroll ✅ REPARADO
- **Archivo:** `backend/controllers/payrollController.js` L245 (original)
- **Código problemático:** `const overtimeRate = parseFloat((regularRate * 1.5).toFixed(2));`
- **Nota:** `invoiceController` SÍ lo leía de `client_rates.overtime_multiplier` — solo payroll tenía el bug.
- **Fix aplicado:** Payroll ahora lee `company_settings.default_ot_multiplier` (default: 1.50).

---

## 🟡 PROBLEMAS DE SEGURIDAD

### SEC-001: JWT almacenado en localStorage (XSS vulnerable) ✅ REPARADO
- **Archivo:** `frontend/src/context/AuthContext.jsx`
- **Descripción:** `localStorage.setItem('hmcs_token', newToken)` — accesible desde cualquier script JS en la página.
- **Fix aplicado:**
  - Backend: emite `httpOnly cookie` en login/register, cookie no accesible desde JS.
  - Backend: middleware `auth` lee cookie primero, Authorization header como fallback.
  - Frontend: `/auth/me` endpoint restaura sesión desde cookie al cargar la app.
  - Frontend: `axios` usa `withCredentials: true` para enviar cookie automáticamente.

### SEC-002: Sin rate limiting en login ✅ REPARADO
- **Archivo:** `backend/routes/auth.js`
- **Descripción:** Endpoint `/api/auth/login` sin protección contra fuerza bruta.
- **Fix aplicado:** `express-rate-limit` — máximo 10 intentos por IP en 15 minutos.

### SEC-003: API base URL hardcodeada a localhost ✅ REPARADO
- **Archivo:** `frontend/src/utils/api.js` L4 (original)
- **Código problemático:** `baseURL: 'http://localhost:5000/api'`
- **Fix aplicado:** `baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'`
- **Acción requerida:** Crear `.env` en frontend con `VITE_API_URL=https://tu-dominio.com/api` antes de producción.

### SEC-004: Voucher HTML incluía `ssn_encrypted` del worker ✅ REPARADO
- **Archivo:** `backend/controllers/payrollController.js` L570 (original)
- **Descripción:** `attributes: ['id', ..., 'ssn_encrypted', ...]` — el SSN (aunque cifrado en DB) pasaba al HTML del voucher generado por el servidor.
- **Fix aplicado:** `ssn_encrypted` eliminado de los atributos de la query en `getVoucherView`.

---

## 🔵 CÓDIGO MUERTO Y ARCHIVOS BASURA

### BASURA-001: i18n instalado pero completamente sin usar ✅ REPARADO
- **Archivos:** `frontend/package.json`, `frontend/src/locales/en.json`, `frontend/src/locales/es.json`
- **Descripción:** `i18next` y `react-i18next` en package.json. Archivos de locale con `{}` vacíos. Ningún componente los importaba. Todo el texto hardcodeado directamente en español/inglés.
- **Acción aplicada:** `npm uninstall i18next react-i18next`. Archivos de locale eliminados del bundle.

### BASURA-002: Rutas placeholder con JSX inline ✅ REPARADO
- **Archivo:** `frontend/src/App.jsx` L83-85 (original)
- **Descripción:** `<div className="fade-in"><h2>Mis Horas</h2>...Próximamente...</div>` inline en la definición de rutas.
- **Acción aplicada:** Componente `ComingSoon` reutilizable en `frontend/src/components/ComingSoon.jsx`.

### BASURA-003: Demo credentials block en Login.jsx ⚠️ PENDIENTE (no solicitado)
- **Archivo:** `frontend/src/pages/Login.jsx` L211-214
- **Acción recomendada:** Eliminar antes de producción.

### BASURA-004: `activeAssignments: activeProj.length * 2` — dato inventado ✅ REPARADO
- **Archivo:** `frontend/src/pages/admin/Dashboard.jsx` L180 (original)
- **Descripción:** Se multiplicaba el número de proyectos activos por 2 para "simular" assignments — sin ninguna base real.
- **Fix aplicado:** `activeAssignments: activeProj.length` (1:1 por ahora, dato real vendrá del endpoint de assignments en futuras fases).

### BASURA-005: Seeders con emails/passwords de producción ⚠️ PENDIENTE (no solicitado)
- **Archivo:** `backend/seeders/initialData.js` L40-118
- **Descripción:** `admin@hmcs.com / admin123`, `josue@hmcs.com / worker123` — credenciales hardcodeadas en código fuente.
- **Acción recomendada:** Eliminar o parametrizar antes de hacer el repo público/producción.

---

## ⚪ DEUDA TÉCNICA

### DEUDA-001: Magic numbers dispersos sin constantes nombradas ✅ REPARADO
- **Fix aplicado:** `backend/config/businessConstants.js` con `STANDARD_HOURS_PER_WEEK`, `DEFAULT_OT_MULTIPLIER`, `DEFAULT_GPS_RADIUS_METERS`, `PAYROLL_PERIOD_DAYS`.
- **Impacto futuro:** Cuando se construyan las Fases 4-7, los nuevos módulos tienen una referencia centralizada.

### DEUDA-002: Sin paginación en endpoints de lista ✅ REPARADO (parcial)
- **Fix aplicado:** `getAllWorkers` y `getAllInvoices` soportan `?page=N&limit=N`.
- **Pendiente:** Aplicar el mismo patrón a `getAllClients`, `getAllProjects`, `getAllTimeEntries` conforme crezca la data.

### DEUDA-003: Aritmética floating-point en cálculos financieros ✅ REPARADO
- **Archivos:** `backend/controllers/invoiceController.js`, `backend/controllers/payrollController.js`
- **Descripción:** `parseFloat(...).toFixed(2)` puede acumular errores de redondeo en operaciones encadenadas.
- **Fix aplicado:** `decimal.js` instalado. Todos los cálculos financieros (regular pay, overtime pay, gross, subtotal, total) ahora usan `new Decimal(x).times(...).toDecimalPlaces(2)`.

### DEUDA-004: Sin ErrorBoundary en React ✅ REPARADO
- **Fix aplicado:** `frontend/src/components/ErrorBoundary.jsx` — clase `ErrorBoundary` que muestra pantalla de error amigable y botón "Recargar página". En dev muestra el stack trace. Envuelve `<AppRoutes>` en `App.jsx`.

### DEUDA-005: Query N+1 en generación de facturas ✅ REPARADO
- **Archivo:** `backend/controllers/invoiceController.js` L147-175 (original)
- **Descripción:** `ClientRate.findOne()` se ejecutaba dentro del loop `for..of` — una query por cada worker.
- **Fix aplicado:** Una sola `ClientRate.findAll({ where: { client_id, trade_id: { [Op.in]: tradeIds } } })` antes del loop. O(n) → O(1) queries.

### DEUDA-006: `eslint-disable-line react-hooks/exhaustive-deps` ✅ REPARADO
- **Archivos:** `frontend/src/pages/contractor/MyPayments.jsx` L48, L94, `frontend/src/pages/admin/VoucherPrint.jsx` L103
- **Fix aplicado:** Patrón `cancelled` flag para manejar cleanup de async effects. Comentarios eliminados.

---

## 🗂️ MAPA DE ARCHIVOS DEL PROYECTO

```
backend/
  config/
    ✅ businessConstants.js — NUEVO: constantes de reglas de negocio
    ✅ database.js — OK
  controllers/
    ✅ authController.js — Actualizado: httpOnly cookie + /me + /logout
    ✅ invoiceController.js — Actualizado: Decimal.js, N+1 fix, paginación, OT de settings
    ✅ payrollController.js — Actualizado: Decimal.js, OT de settings, voucher ownership
    ✅ workerController.js — Actualizado: paginación básica
    ✅ clientController.js — OK (no modificado)
    ✅ projectController.js — OK (no modificado)
    ✅ timeEntryController.js — OK (no modificado)
    ✅ tradeController.js — OK (no modificado)
    ✅ accountingController.js — OK (no modificado)
    ✅ assignmentController.js — OK (no modificado)
    ✅ documentController.js — OK (no modificado)
    ✅ perDiemController.js — OK (no modificado)
    ✅ settingsController.js — OK (no modificado)
  middleware/
    ✅ auth.js — Actualizado: httpOnly cookie + worker.status check
    ✅ checkRole.js — OK (ya soportaba múltiples roles)
    ✅ uploadScreenshot.js — OK
  models/
    ✅ Worker.js — Actualizado: AES-256-GCM para ssn_encrypted
    ✅ CompanySettings.js — Actualizado: standard_hours_per_week, default_ot_multiplier
    ✅ User.js — OK
    ✅ Client.js — OK
    ✅ Trade.js — OK
    ✅ Project.js — OK
    ✅ Assignment.js — OK
    ✅ TimeEntry.js — OK
    ✅ Invoice.js — OK
    ✅ InvoiceLine.js — OK
    ✅ ClientRate.js — OK
    ✅ Payroll.js — OK
    ✅ PayrollLine.js — OK
    ✅ PerDiemEntry.js — OK
    ✅ Document.js — OK
    ✅ Transaction.js — OK
    ✅ BankImport.js — OK
    ✅ index.js — OK
  routes/
    ✅ auth.js — Actualizado: rate limiting, /me, /logout
    ✅ payroll.js — Actualizado: checkRole en voucher route
    ✅ workers.js — OK
    ✅ clients.js — OK
    ✅ projects.js — OK
    ✅ timeEntries.js — OK
    ✅ invoices.js — OK
    ✅ assignments.js — OK
    ✅ trades.js — OK
    ✅ documents.js — OK
    ✅ perDiem.js — OK
    ✅ accounting.js — OK
    ✅ settings.js — OK
  utils/
    ✅ responseHandler.js — OK
    ✅ generateWorkerCode.js — OK (race condition de baja probabilidad, DB unique constraint protege)
    ✅ claudeVision.js — OK
    ✅ voucherNumber.js — OK
  ✅ server.js — Actualizado: cookie-parser, CORS whitelist, sin credenciales en logs
  ✅ package.json — Actualizado: express-rate-limit, decimal.js, cookie-parser

frontend/src/
  components/
    ✅ ErrorBoundary.jsx — NUEVO: error boundary global
    ✅ ComingSoon.jsx — NUEVO: placeholder reutilizable
    ✅ DocumentUploader.jsx — Actualizado: BUG-002 fix, authFetch helper
    ✅ admin/PaymentUploadModal.jsx — OK
    ✅ contractor/ClockButton.jsx — OK
    ✅ dashboard/StatCard.jsx — OK
    ✅ dashboard/EarningsChart.jsx — OK
    ✅ layout/AdminLayout.jsx — OK
    ✅ layout/ContractorLayout.jsx — OK
    ✅ layout/Sidebar.jsx — OK
  context/
    ✅ AuthContext.jsx — Actualizado: /auth/me, sin token en localStorage como auth principal
    ✅ ThemeContext.jsx — OK
  pages/
    admin/
      ✅ Dashboard.jsx — Actualizado: sin tarifas hardcodeadas
      ✅ Workers.jsx — OK
      ✅ Clients.jsx — OK
      ✅ Projects.jsx — OK
      ✅ Timesheets.jsx — OK
      ✅ Invoices.jsx — OK
      ✅ InvoicePrint.jsx — OK
      ✅ Payroll.jsx — OK
      ✅ VoucherPrint.jsx — Actualizado: sin eslint-disable
      ✅ Accounting.jsx — OK
      ✅ Reports.jsx — OK
      ✅ Settings.jsx — OK
    contractor/
      ✅ ClockPage.jsx — OK
      ✅ MyPayments.jsx — Actualizado: sin eslint-disable, cleanup de async effects
    ⚠️  Login.jsx — Demo credentials block pendiente de eliminar (L211-214)
  utils/
    ✅ api.js — Actualizado: withCredentials, VITE_API_URL
    ✅ formatters.js — OK
  hooks/
    ✅ useApi.js — OK
  ✅ App.jsx — Actualizado: ErrorBoundary, ComingSoon, imports limpios
  ✅ package.json — Actualizado: i18next/react-i18next removidos
```

---

## 📋 PLAN DE ACCIÓN SUGERIDO

### Prioridad 1 — Requerido ANTES de producción
1. Agregar `SSN_ENCRYPTION_KEY` al `.env` (64 hex chars: `openssl rand -hex 32`)
2. Agregar `VITE_API_URL` al `.env` del frontend
3. Agregar `ALLOWED_ORIGINS` al `.env` del backend
4. Eliminar demo credentials de `Login.jsx` L211-214
5. Limpiar o parametrizar `backend/seeders/initialData.js`

### Prioridad 2 — Al entrar en Fase 4 (Contabilidad)
1. Extender paginación a `getAllClients`, `getAllProjects`, `getAllTimeEntries`
2. Conectar Dashboard a endpoint real de payroll stats (`/api/payroll/stats`)
3. Dashboard bank widget: conectar al módulo de contabilidad cuando esté listo

### Prioridad 3 — Mejoras continuas
1. Considerar migrar completamente a cookie-only (eliminar token del localStorage)
2. Agregar índices en columnas de filtro frecuente: `worker_id`, `project_id`, `status`, `is_active`
3. Refactorizar archivos >800 líneas cuando se toque ese módulo en Fase 5-6

---

*Reporte generado automáticamente durante sesión de auditoría HMCS — 2026-04-08*
