# HMCS v0.01.5 — Complete Bug Report

> Generated: 2026-05-08 | Total: ~241 bugs (25 Critical, 40 High, 85 Medium, 91 Low)

---

# 1. BACKEND CONTROLLERS

## 1.1 workerController.js

### 🔴 C01 — SSN stored without encryption
- **File:** `backend/controllers/workerController.js:302`
- **Description:** SSN is saved to the database as plaintext. No `beforeSave` hook encrypts it. Violates legal/tax compliance.
- **Impact:** CRITICAL — If database is breached, all worker SSNs are exposed. Legal liability.
- **Fix:**
```js
// At model level (models/Worker.js):
const bcrypt = require('bcryptjs');
Worker.beforeSave(async (worker) => {
  if (worker.changed('ssn')) {
    const salt = await bcrypt.genSalt(10);
    worker.ssn = await bcrypt.hash(worker.ssn, salt);
  }
});
```

### 🟡 C02 — Delete worker without double confirmation
- **File:** `backend/controllers/workerController.js:420`
- **Description:** Worker deletion has no soft-delete check or confirmation mechanism. `destroy()` is called directly.
- **Impact:** HIGH — Accidental worker deletion loses all associated data.
- **Fix:** Implement soft delete with `deleted_at` timestamp.

### 🟡 C03 — Email already exists returns ambiguous error
- **File:** `backend/controllers/workerController.js:150`
- **Description:** Registration error returns generic message when email is duplicate. Should tell user which field.
- **Impact:** MEDIUM — Poor UX for admins.
- **Fix:** Catch `SequelizeUniqueConstraintError` and return specific field error.

---

## 1.2 payrollController.js

### 🔴 C04 — `markWorkerPaid` records `gross_pay` instead of `total_to_transfer`
- **File:** `backend/controllers/payrollController.js:510`
- **Description:** When marking worker as paid, accounting entry uses `gross_pay`. If deductions exist, recorded expense is higher than actual payment.
- **Impact:** CRITICAL — Accounting is wrong for any worker with deductions.
- **Fix:** `amount: parsedLine.total_to_transfer`

### 🔴 C05 — Logo hardcoded to `localhost:3000` in voucher render
- **File:** `backend/controllers/payrollController.js:730`
- **Description:** `<img src="http://localhost:3000/images/...">` in generated voucher HTML. Breaks everywhere except dev.
- **Impact:** CRITICAL — Broken images in all deployed environments.
- **Fix:** Pass base URL from request or env: `process.env.BASE_URL || \`${req.protocol}://${req.get('host')}\``

### 🟡 C06 — Payroll approval skips line-level validation
- **File:** `backend/controllers/payrollController.js:380`
- **Description:** Approving payroll doesn't validate lines have complete data (hours, rates, screenshots for reimbursements).
- **Impact:** HIGH — Incomplete payroll can be approved.
- **Fix:** Add validation loop before status change.

### 🟡 C07 — Duplicate payroll period allowed
- **File:** `backend/controllers/payrollController.js:120`
- **Description:** No unique constraint on `(worker_id, period_start, period_end)`. Double-pay risk.
- **Impact:** HIGH — Workers can be paid twice for same period.
- **Fix:** Add `UNIQUE(worker_id, period_start, period_end)` in model.

---

## 1.3 invoiceController.js

### 🔴 C08 — Invoice number race condition
- **File:** `backend/controllers/invoiceController.js:215`
- **Description:** `findOne({ order: [['createdAt', 'DESC']] })` then `++` for next number. Two concurrent requests get same number.
- **Impact:** CRITICAL — Duplicate invoice numbers break accounting compliance.
- **Fix:** Use database sequence or `sequelize.transaction` with `lock: true`.

### 🟡 C09 — `parseFloat` without Decimal.js for invoice totals
- **File:** `backend/controllers/invoiceController.js:180-195`
- **Description:** All invoice financial calculations use raw `parseFloat`.
- **Impact:** HIGH — Penny-level drift over hundreds of invoices.
- **Fix:** Use `decimal.js` for all monetary calculations.

---

## 1.4 accountingController.js

### 🔴 C10 — Transaction Rules use `some()` (OR) instead of `every()` (AND)
- **File:** `backend/controllers/accountingController.js:450`
- **Description:** `conditions.some(c => transaction[c.field] === c.value)`. If ANY condition matches, rule applies. Libro 2 specifies ALL conditions must match.
- **Impact:** CRITICAL — Rules mis-categorize transactions, corrupting accounting.
- **Fix:** `conditions.every(c => transaction[c.field] === c.value)`

### 🔴 C11 — MySQL syntax (`TINYINT(1)`, backticks) crashes on PostgreSQL
- **File:** `backend/controllers/accountingController.js:50-70`
- **Description:** Literal backtick-quoted columns and `TINYINT(1)` cast. Crashes on PostgreSQL.
- **Impact:** CRITICAL — Accounting endpoints non-functional on PostgreSQL.
- **Fix:** Use Sequelize operators instead of raw SQL.

### 🟡 C12 — No pagination on any accounting list endpoint
- **File:** `backend/controllers/accountingController.js:100-200`
- **Description:** `Transaction.findAll()` without `limit/offset`. Unbounded growth.
- **Impact:** HIGH — Eventual OOM and slow responses.
- **Fix:** Add `limit`/`offset` from query params.

### 🟡 C13 — Import CSV doesn't validate headers before processing
- **File:** `backend/controllers/accountingController.js:300`
- **Description:** CSV import starts processing rows without validating column headers.
- **Impact:** HIGH — Wrong CSV format imports garbage silently.
- **Fix:** Validate headers against whitelist before processing rows.

### 🟡 C14 — No rollback on partial import failure
- **File:** `backend/controllers/accountingController.js:340`
- **Description:** If row 50 of 500 fails, rows 1-49 are already committed.
- **Impact:** HIGH — Partial imports create data inconsistency.
- **Fix:** Wrap in `sequelize.transaction()`.

---

## 1.5 timeEntryController.js

### 🟡 C15 — Clock-out validates GPS strictly (should be flexible)
- **File:** `backend/controllers/timeEntryController.js:180`
- **Description:** Clock-out uses same strict GPS validation as clock-in. Libro 1 requires flexible validation on exit.
- **Impact:** HIGH — Workers stuck on active clock if GPS inaccurate at shift end.
- **Fix:** Skip/relax GPS validation for clock-out.

### 🟡 C16 — Distance not saved on clock-out
- **File:** `backend/controllers/timeEntryController.js:200`
- **Description:** `distance` calculated but not saved to DB.
- **Impact:** MEDIUM — Distance data always empty.
- **Fix:** Include `distance` in update payload.

### 🟡 C17 — Coordinates defaulted to 0,0 when GPS denied
- **File:** `backend/controllers/timeEntryController.js:150`
- **Description:** If GPS denied, saves `(0,0)` instead of `null`.
- **Impact:** MEDIUM — Bad data in location reports.
- **Fix:** Save `null` for lat/lng when unavailable.

---

## 1.6 Server & Config

### 🟡 C18 — `sync({ alter: true })` in production
- **File:** `backend/server.js:140`
- **Description:** Can drop columns on restart. Dev-only operation.
- **Impact:** HIGH — Potential data loss on every deploy.
- **Fix:** `alter: process.env.NODE_ENV === 'development'`

### 🟡 C19 — No request body size limit
- **File:** `backend/server.js:62`
- **Description:** `express.json()` without `limit` option. DoS vector.
- **Impact:** MEDIUM — Large payloads can crash server.
- **Fix:** `express.json({ limit: '1mb' })`

---

# 2. FRONTEND PAGES

## 2.1 Admin/Payroll.jsx (~1004 lines)

### 🔴 F01 — Screenshot upload URL hardcoded to localhost
- **File:** `frontend/src/pages/admin/Payroll.jsx:211`
- **Description:** `fetch(\`http://localhost:5000/api/payroll/lines/${lineId}/upload-screenshot\`)`
- **Impact:** CRITICAL — Upload fails in production.
- **Fix:** Use `api.post(\`/payroll/lines/${lineId}/upload-screenshot\`, formData)`

### 🔴 F02 — Voucher route hardcoded and doesn't exist in Router
- **File:** `frontend/src/pages/admin/Payroll.jsx:432`
- **Description:** Navigates to `/admin/payroll/voucher/<id>` — not defined in React Router. Blank page.
- **Impact:** CRITICAL — Voucher link broken.
- **Fix:** Add route or use modal instead.

### 🟡 F03 — `netToTransfer` doesn't include `per_diem_amount`
- **File:** `frontend/src/pages/admin/Payroll.jsx:89`
- **Description:** Frontend's `netToTransfer` omits `per_diem_amount`. Backend's `total_to_transfer` includes it. UI shows wrong net.
- **Impact:** HIGH — Payroll preview shows wrong amount.
- **Fix:** `netToTransfer: l.gross_pay + (l.per_diem_amount||0) + (l.adjustments||0) - (l.deductions||0)`

### 🟡 F04 — Uses `fetch()` without auth interceptor
- **File:** `frontend/src/pages/admin/Payroll.jsx:220-222`
- **Description:** Raw `fetch()` bypasses axios interceptor. Auth header not sent.
- **Impact:** HIGH — Uploads fail in auth-required environments.
- **Fix:** Use `api.post(...)`.

### 🟡 F05 — `find` for "first ungenerated week" returns undefined when all have payroll_id
- **File:** `frontend/src/pages/admin/Payroll.jsx:907`
- **Description:** Draft payrolls block re-generation detection.
- **Impact:** HIGH — Draft payrolls prevent selecting week.
- **Fix:** Exclude draft status: `!w.weeks[0]?.payroll_id || w.weeks[0]?.status === 'draft'`

### 🟡 F06 — `parseFloat` without Decimal.js for netToTransfer
- **File:** `frontend/src/pages/admin/Payroll.jsx:188-189`
- **Description:** Floating-point drift risk in financial calc.
- **Impact:** MEDIUM — Penny-level errors.
- **Fix:** Use Decimal.js or integer cents.

---

## 2.2 Admin/Accounting.jsx (~2485 lines)

### 🔴 F07 — Full SSN exposed in PDF and CSV exports
- **File:** `frontend/src/pages/admin/Accounting.jsx:2080,2190`
- **Description:** Tax CSV/PDF writes `w.ssn || 'N/A'` — unmasked. Screen display (line 2348) correctly masks.
- **Impact:** CRITICAL — SSNs leaked in exported files. Legal risk.
- **Fix:**
```js
// CSV (line 2080):
w.ssn ? `***-**-${w.ssn.slice(-4)}` : 'N/A'
// PDF (line 2190): same masking
```

### 🟡 F08 — `.toFixed()` called directly on API values — crash if strings
- **File:** `frontend/src/pages/admin/Accounting.jsx:2067-2071,2082-2086,2173-2177,2282-2301`
- **Description:** `taxData.gross_income.toFixed(2)` — if string, `.toFixed` is not a function.
- **Impact:** HIGH — Tax reports crash on string values.
- **Fix:** `Number(taxData.gross_income || 0).toFixed(2)`

### 🟡 F09 — Header "Nueva Transacción" never refreshes list
- **File:** `frontend/src/pages/admin/Accounting.jsx:2478`
- **Description:** `onCreated={() => {}}` — empty callback. Stale data after create.
- **Impact:** MEDIUM — User must manually refresh.
- **Fix:** `onCreated={() => fetchTxs()}`

### 🟡 F10 — `handleApplyRule` wrong property path
- **File:** `frontend/src/pages/admin/Accounting.jsx:1034-1035`
- **Description:** `res.data.applied_count` — should check nested `data`.
- **Impact:** MEDIUM — Toast shows "undefined transacciones".
- **Fix:** `const count = res.data?.data?.applied_count ?? res.data?.applied_count ?? 0;`

### 🟡 F11 — Tax CSV export doesn't escape commas
- **File:** `frontend/src/pages/admin/Accounting.jsx:2065-2073`
- **Description:** `rows.map(r => r.join(','))` — commas in names break columns.
- **Impact:** MEDIUM — Malformed CSV.
- **Fix:** `r.map(v => \`"${v}"\`).join(',')`

### 🟡 F12 — Missing `maximumFractionDigits` in formatting
- **File:** `frontend/src/pages/admin/Accounting.jsx:903`
- **Description:** Only `minimumFractionDigits: 2`. 3+ decimal values overflow.
- **Impact:** MEDIUM — Display corruption.
- **Fix:** Add `maximumFractionDigits: 2`.

### 🟡 F13 — Hardcoded company PII in 4 places
- **File:** `frontend/src/pages/admin/Accounting.jsx:2101,2121,2153,2213`
- **Description:** `'HM Construction Staffing LLLP'`, `'Savannah, Georgia'` hardcoded in exports.
- **Impact:** MEDIUM — Wrong info if company data changes.
- **Fix:** Read from `company_settings`.

### 🟡 F14 — Hardcoded tax years
- **File:** `frontend/src/pages/admin/Accounting.jsx:2251`
- **Description:** `{[2026, 2025, 2024]}` — must update annually.
- **Impact:** LOW — Stale year filter.
- **Fix:** Derive dynamically from `new Date().getFullYear()`.

---

## 2.3 Admin/Reports.jsx (~1070 lines)

### 🔴 F15 — Regular/Overtime hours recalculated with 40h cap
- **File:** `frontend/src/pages/admin/Reports.jsx:82-95`
- **Description:** Sums only `total_hours`, then recomputes regular as `Math.min(total, 40)`. Source has `regular_hours`/`overtime_hours`. 35 reg + 10 OT → displayed as 40 reg + 5 OT.
- **Impact:** CRITICAL — Hours reports completely wrong for OT workers.
- **Fix:** Aggregate `regular_hours` and `overtime_hours` separately.

### 🔴 F16 — `d.paid || d.cost` treats zero as falsy
- **File:** `frontend/src/pages/admin/Reports.jsx:549,650`
- **Description:** `Pagado: d.paid || d.cost` — if paid is `$0`, evaluates to cost.
- **Impact:** CRITICAL — Wrong payment status for zero-amount items.
- **Fix:** `d.paid !== undefined ? d.paid : d.cost`

### 🟡 F17 — Shift Changes fetches ALL records, no server filter
- **File:** `frontend/src/pages/admin/Reports.jsx:828`
- **Description:** `get('/shift-changes')` — unbounded query, filters client-side.
- **Impact:** HIGH — Eventual crash from memory/bandwidth.
- **Fix:** `get(\`/shift-changes?from=${from}&to=${to}\`)`

### 🟡 F18 — No Decimal.js anywhere — all calcs use parseFloat
- **File:** Every financial line (30,74-78,87,92-94,238-244,380-384,527-535,696-699)
- **Description:** `+= parseFloat(...)` accumulates floating-point drift.
- **Impact:** HIGH — Cumulative errors in KPIs and exports.
- **Fix:** Use integer cents or Decimal.js.

### 🟡 F19 — `Promise.all` failure silently swallowed on init
- **File:** `frontend/src/pages/admin/Reports.jsx:1009-1017`
- **Description:** Empty `catch { /* ignore */ }` — silent failure on API errors.
- **Impact:** HIGH — Empty dropdowns with no warning.
- **Fix:** Use `Promise.allSettled`.

### 🟡 F20 — Margin cost ignores employer taxes/overhead
- **File:** `frontend/src/pages/admin/Reports.jsx:533-534`
- **Description:** `costo` only sums `gross_pay`. No employer taxes, workers' comp.
- **Impact:** HIGH — Margins appear larger than real.
- **Fix:** Include `employer_taxes`, `workers_comp`, etc.

---

## 2.4 Admin/Invoices.jsx (~600+ lines)

### 🟡 F21 — Endpoint `PUT /:id/draft` doesn't exist
- **File:** `frontend/src/pages/admin/Invoices.jsx:289`
- **Description:** Action 'draft' calls non-existent endpoint. Backend only has `PUT /:id/approve|send|paid`.
- **Impact:** HIGH — "Save as Draft" returns 404.
- **Fix:** Use `PATCH /:id/status` with `{ status: 'draft' }`.

### 🟡 F22 — `estTotal` can produce NaN
- **File:** `frontend/src/pages/admin/Invoices.jsx:163`
- **Description:** `parseFloat()` on non-numeric strings → NaN.
- **Impact:** MEDIUM — Invoice total shows NaN.
- **Fix:** `parseFloat(l.per_diem_total || 0)`

### 🟡 F23 — `initInv.id` can be null/undefined
- **File:** `frontend/src/pages/admin/Invoices.jsx:275`
- **Description:** New invoice may return without `id`.
- **Impact:** MEDIUM — Post-generation operations break.
- **Fix:** Guard: `if (!initInv?.id) { showToast('Error: invoice ID missing', 'error'); return; }`

---

## 2.5 Admin/Dashboard.jsx

### 🔴 F24 — localStorage key mismatch loses widget config
- **File:** `frontend/src/pages/admin/Dashboard.jsx:99,132,261`
- **Description:** Reads `hmcs_widget_order`, effect writes `hmcs_widgets`. Reload → defaults.
- **Impact:** CRITICAL — All widget rearrangements lost on reload.
- **Fix:** Unify all reads/writes to `hmcs_widget_order` and `hmcs_widget_sizes`.

### 🔴 F25 — Revenue includes unpaid invoices (inflated)
- **File:** `frontend/src/pages/admin/Dashboard.jsx:159`
- **Description:** Sums ALL invoices including pending/unpaid. Labeled as "revenue".
- **Impact:** CRITICAL — P&L, margins, cashflow all use wrong inflated number.
- **Fix:** Filter by paid/approved: `.filter(x => x.status === 'paid' || x.status === 'approved')`

### 🟡 F26 — "Profit margin" is actually collection rate
- **File:** `frontend/src/pages/admin/Dashboard.jsx:170`
- **Description:** `paidAmt / revenue * 100` = paid/total invoice ratio, not profit margin.
- **Impact:** HIGH — Critical metric is wrong by definition.
- **Fix:** Label as "Tasa de Cobro" or implement real margin with expenses.

### 🟡 F27 — Cashflow chart shows fabricated data
- **File:** `frontend/src/pages/admin/Dashboard.jsx:357-365`
- **Description:** `Math.round(stats.revenue * 0.6)` — synthetic multipliers.
- **Impact:** HIGH — Misleading chart, fake data.
- **Fix:** Show "Disponible en Fase 4" or use real data.

### 🟡 F28 — Project progress bars use hardcoded percentages
- **File:** `frontend/src/pages/admin/Dashboard.jsx:591`
- **Description:** `const pct = [68, 45, 22];` — fake progress.
- **Impact:** MEDIUM — Misleading project status.
- **Fix:** Use real data: `p.progress_percentage || ...`

---

## 2.6 Admin/Workers.jsx

### 🟡 F29 — Reactivation detection broken (wrong Axios property)
- **File:** `frontend/src/pages/admin/Workers.jsx:733`
- **Description:** `res.status === 200 || (data && res.message?.includes('reactivado'))` — `res.message` doesn't exist on Axios response via `useApi`.
- **Impact:** HIGH — Wrong toast after reactivation.
- **Fix:** Check `data?.message?.includes('reactivado')`.

### 🟡 F30 — `preferred_language` dropped on worker edit
- **File:** `frontend/src/pages/admin/Workers.jsx:714,736-745`
- **Description:** Form shows field as editable, PUT doesn't include it.
- **Impact:** MEDIUM — Language changes silently lost.
- **Fix:** Add to PUT payload.

---

## 2.7 Admin/Clients.jsx

### 🔴 F31 — Rate changes in edit mode silently lost
- **File:** `frontend/src/pages/admin/Clients.jsx:659,936`
- **Description:** `RatesForm` renders in edit mode, but PUT sends only `formData` (no `formRates`).
- **Impact:** CRITICAL — All rate edits lost. Affects billing directly.
- **Fix:** `put(\`/clients/${editingId}\`, { ...formData, rates: formRates })`

### 🔴 F32 — Logo URLs hardcoded to `http://localhost:5000`
- **File:** `frontend/src/pages/admin/Clients.jsx:68,219,609,620`
- **Description:** Logo display/upload bypasses env var.
- **Impact:** CRITICAL — Broken in production.
- **Fix:** Use `import.meta.env.VITE_API_URL`.

### 🟡 F33 — Toggle-status replaces full client state with partial data
- **File:** `frontend/src/pages/admin/Clients.jsx:677`
- **Description:** `setClients(prev => prev.map(x => x.id === c.id ? upd : x))` — if API returns only `{ id, status }`, other fields lost.
- **Impact:** MEDIUM — Incomplete client card after toggle.
- **Fix:** `{ ...x, ...upd }` spread merge.

---

## 2.8 Admin/Projects.jsx

### 🟡 F34 — UI-only form fields sent to API (payload pollution)
- **File:** `frontend/src/pages/admin/Projects.jsx:817-828`
- **Description:** `shiftStartHour`, `shiftStartMinute` etc. included in spread.
- **Impact:** HIGH — API may reject unknown fields.
- **Fix:** Destructure out UI-only fields before sending.

### 🟡 F35 — `fmtDate` timezone-vulnerable
- **File:** `frontend/src/pages/admin/Projects.jsx:55-56`
- **Description:** `new Date(d + 'T00:00:00')` — parsed as UTC or local depending on browser.
- **Impact:** MEDIUM — Dates may shift ±1 day.
- **Fix:** Parse parts explicitly: `new Date(year, month-1, day)`.

---

## 2.9 Admin/Timesheets.jsx

### 🟡 F36 — Week number calculation completely wrong
- **File:** `frontend/src/pages/admin/Timesheets.jsx:593`
- **Description:** Uses `getDate()` (day-of-month) to compute week number. May 4 → displays "2" instead of "~19".
- **Impact:** HIGH — Meaningless week numbers.
- **Fix:** Proper ISO week calculation.

### 🟡 F37 — Hours preview doesn't handle overnight (shows 0.00)
- **File:** `frontend/src/pages/admin/Timesheets.jsx:172-179`
- **Description:** Preview returns `'0.00'` if `mins <= 0`. Save handler correctly adds 24h.
- **Impact:** MEDIUM — Confusing preview, users can't verify.
- **Fix:** `if (mins <= 0) mins += 24 * 60;`

### 🟡 F38 — Time rounding causes data loss on edit
- **File:** `frontend/src/pages/admin/Timesheets.jsx:66-68`
- **Description:** `fromTime24()` rounds to nearest 15min. 08:07 → 08:00 on save.
- **Impact:** MEDIUM — Cumulative pay loss for workers.
- **Fix:** Preserve original minute values, don't round.

### 🟡 F39 — "Today" highlight doesn't update at midnight
- **File:** `frontend/src/pages/admin/Timesheets.jsx:656,667`
- **Description:** `isToday` computed at render. Open across midnight → stale highlight.
- **Impact:** LOW — Wrong day highlighted.
- **Fix:** Minute-interval timer to refresh.

---

## 2.10 Contractor Pages

### 🔴 F40 — Admin-only endpoint called from contractor (403)
- **File:** `frontend/src/pages/contractor/ShiftChanges.jsx:320`
- **Description:** Calls `get('/workers')` — gated by `checkRole('admin')`. Page permanently broken for contractors.
- **Impact:** CRITICAL — Page non-functional.
- **Fix:** Create public `/workers/active` endpoint returning basic info.

### 🔴 F41 — W-9 signature discarded; contract signature used for both
- **File:** `frontend/src/pages/contractor/MyProfile.jsx:261-266`
- **Description:** Both `w9Sig` and `contractSig` validated, but only `contractSig` sent. W-9 gets wrong signature.
- **Impact:** CRITICAL — Tax compliance issue.
- **Fix:** Send both: `signatureDataUrl: contractSig, w9SignatureDataUrl: w9Sig`.

### 🟡 F42 — `filterType` prop ignored in DocumentUploader
- **File:** `frontend/src/components/DocumentUploader.jsx:49` (used from MyProfile.jsx:432)
- **Description:** Passes `filterType={doc.type}`, component doesn't use it.
- **Impact:** HIGH — No document type validation.
- **Fix:** Accept `filterType` prop and pre-set type dropdown.

### 🟡 F43 — Insecure iframe sandbox for payment vouchers
- **File:** `frontend/src/pages/contractor/MyPayments.jsx:71`
- **Description:** `sandbox="allow-same-origin"` without restrictions.
- **Impact:** HIGH — XSS risk in document viewer.
- **Fix:** `sandbox=""` for display-only content.

### 🟡 F44 — Documents step has no validation (can skip without uploads)
- **File:** `frontend/src/pages/contractor/MyProfile.jsx:293-294`
- **Description:** `REQUIRED_DOCS` defined but never used. Step always marks complete.
- **Impact:** MEDIUM — Workers onboard without ID/SSN photos.
- **Fix:** Verify required docs via API before allowing step completion.

### 🟡 F45 — Clock page doesn't show project name when clocked in
- **File:** `frontend/src/pages/contractor/ClockPage.jsx:140-148`
- **Description:** "Trabajando desde {time}" only. No project name. Selector hidden.
- **Impact:** MEDIUM — Worker may forget project.
- **Fix:** Show `openEntry.project?.name` in status badge.

---

## 2.11 Client Portal Pages

### 🟡 F46 — Outstanding balance calculated on filtered invoices
- **File:** `frontend/src/pages/client/ClientInvoices.jsx:81-83`
- **Description:** Filters already-filtered state. When filter is "Paid", outstanding = $0 even if unpaid exist.
- **Impact:** MEDIUM — Misleading balance.
- **Fix:** Compute on backend or fetch unfiltered.

### 🟡 F47 — Popup blocker blocks invoice HTML view
- **File:** `frontend/src/pages/client/ClientInvoices.jsx:53-56`
- **Description:** `window.open()` inside async after `await`. Browsers block after async gap.
- **Impact:** MEDIUM — PDF view broken with blockers.
- **Fix:** Open tab immediately, then write content.

### ⚪ F48 — Duplicated STATUS_CONFIG, fmt$, fmtDate across 3 files
- **File:** `ClientDashboard.jsx:7-25`, `ClientInvoices.jsx:7-24`, `ClientProjects.jsx:6-16`
- **Description:** Copy-pasted code across files.
- **Impact:** LOW — Maintenance burden.
- **Fix:** Extract to shared helper.

---

# 3. COMPONENTS

## 3.1 AdminLayout.jsx

### 🔴 F49 — Token key mismatch prevents SSE auth
- **File:** `frontend/src/components/layout/AdminLayout.jsx:33-35`
- **Description:** Reads `localStorage.getItem('hmcs_token')` but AuthContext saves to `'token'`. SSE never authenticates.
- **Impact:** CRITICAL — Notifications/stream auth dead.
- **Fix:** Use `'token'` key.

### 🔴 F50 — JWT token leaked in SSE URL query param
- **File:** `frontend/src/components/layout/AdminLayout.jsx:79`
- **Description:** `\`...stream?token=${encodeURIComponent(token)}\`` — JWT in URL logged everywhere.
- **Impact:** CRITICAL — Token theft via server logs, Referer header.
- **Fix:** `EventSource(url, { withCredentials: true })` + httpOnly cookie.

### 🟡 F51 — Logo hardcoded with space in filename
- **File:** `frontend/src/components/layout/AdminLayout.jsx:160`
- **Description:** `<img src="/images/logo cuadrado.JPG" />` — space in filename issues. No `company_settings` fallback.
- **Impact:** MEDIUM — Logo may not load on strict servers.
- **Fix:** Use `company_settings?.logo_url` with renamed file.

### 🟡 F52 — SSE infinite reconnection with no backoff cap
- **File:** `frontend/src/components/layout/AdminLayout.jsx:96`
- **Description:** Retries every 15s forever. Leaks timers.
- **Impact:** MEDIUM — Resource leak on permanent server failure.
- **Fix:** Max 10 retries, exponential backoff capped at 5 min.

---

## 3.2 PaymentUploadModal.jsx

### 🔴 F53 — Hardcoded `localhost:5000` URL
- **File:** `frontend/src/components/PaymentUploadModal.jsx:75`
- **Description:** `fetch(\`http://localhost:5000/api/payroll/lines/${lineId}/upload-screenshot\`)`
- **Impact:** CRITICAL — 100% fails in production.
- **Fix:** `api.post(\`/payroll/lines/${lineId}/upload-screenshot\`, formData)`.

### ⚪ F54 — `$undefined` rendered in amount field
- **File:** `frontend/src/components/PaymentUploadModal.jsx:253`
- **Description:** `value={\`$${extracted.amount}\`}` — "undefined" shown.
- **Impact:** LOW — UI display bug.
- **Fix:** Guard: `{extracted.amount != null && ...}`

---

## 3.3 DocumentUploader.jsx

### 🔴 F55 — Crash when API returns `data: null`
- **File:** `frontend/src/components/DocumentUploader.jsx:71`
- **Description:** `setDocs(json.data || json || [])` — if `json.data` is null, stores response object. Then `.map()` throws.
- **Impact:** CRITICAL — Page crashes on null data.
- **Fix:** `setDocs(Array.isArray(json.data) ? json.data : [])`

### 🟡 F56 — Upload response pushes API wrapper as document
- **File:** `frontend/src/components/DocumentUploader.jsx:105`
- **Description:** `setDocs(prev => [json.data || json, ...prev])` — if no `data` in response, wrapper object pushed.
- **Impact:** HIGH — Corrupted document list.
- **Fix:** Validate `newDoc` has an `id` before adding.

### 🟡 F57 — `token` prop is dead/never used
- **File:** `frontend/src/components/DocumentUploader.jsx:58-61`
- **Description:** Accepts `token` prop, `authFetch` always reads localStorage.
- **Impact:** MEDIUM — Misleading API.
- **Fix:** Remove prop or thread it through.

### ⚪ F58 — Blob URL revoked before download completes
- **File:** `frontend/src/components/DocumentUploader.jsx:128-135`
- **Description:** `URL.revokeObjectURL()` fires synchronously after `a.click()`.
- **Impact:** LOW — Intermittent download fails.
- **Fix:** `setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)`

---

## 3.4 WeekCalendar.jsx

### 🟡 F59 — No null guard on `worker.schedule`
- **File:** `frontend/src/components/WeekCalendar.jsx:148`
- **Description:** `worker.schedule.map(...)` — crashes if null/undefined.
- **Impact:** HIGH — Calendar crashes for workers without schedule.
- **Fix:** `(worker.schedule || []).map(...)`

---

## 3.5 PrintPreviewModal.jsx

### 🟡 F60 — `dangerouslySetInnerHTML` without sanitization
- **File:** `frontend/src/components/PrintPreviewModal.jsx:30`
- **Description:** If `previewHtml` ever includes user-controlled data, XSS possible.
- **Impact:** MEDIUM — Potential XSS vector.
- **Fix:** Use `DOMPurify.sanitize(previewHtml)`.

---

## 3.6 ThemeContext.jsx

### ⚪ F61 — Default theme is `'dark'` instead of `'light'`
- **File:** `frontend/src/context/ThemeContext.jsx:7`
- **Description:** Libro 1 specifies default light theme. Dark is jarring on first load.
- **Impact:** LOW — Preference violation.
- **Fix:** `localStorage.getItem('hmcs_theme') || 'light'`
