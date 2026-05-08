# HMCS v0.01.5 — CSS/Style Bugs & Priority Plan

*Part 2 of the complete bug report*

---

# 4. CSS/STYLES — 110 Issues

## 4.1 Layout-Breaking

| # | File:Line | Issue | Impact |
|---|-----------|-------|--------|
| CSS01 | `Workers.css:783` — `.workers-modal-overlay` z-index 1000 | Conflicts with unified modal overlay at 500 | 🔴 CRITICAL |
| CSS02 | `Workers.css:1360,1371` — `.drawer-overlay` z-index 900, `.worker-drawer` z-index 910 | Drawers render ABOVE modals | 🟠 HIGH |
| CSS03 | `Dashboard.css:903,919` — `.ds-drawer-overlay` z-index 500, `.ds-drawer` z-index 501 | Same z-index as modal system → stacking fights | 🟠 HIGH |
| CSS04 | `Accounting.css:338,349` — `.modal-overlay` z-index 500, `.modal-content` z-index 501 | Duplicate modal system conflicting with `modals.css` | 🟠 HIGH |
| CSS05 | `modals.css:30-38` — `.cl-overlay` `align-items: flex-start` with `padding: 48px 20px` | Modal pinned to top on short viewports | 🟡 MEDIUM |
| CSS06 | `Workers.css:831-834` — `.workers-modal__header` `position: sticky; top: 0; z-index: 10` | Sticky doesn't work inside flex column | 🟡 MEDIUM |
| CSS07 | `InvoicePrint.css:33-34` — `.ip-toolbar` sticky on print page without `.no-print` | Breaks print layout | 🟡 MEDIUM |
| CSS08 | `VoucherPrint.css:25-27` — Same as CSS07 for `.vp-actions` | Breaks print layout | 🟡 MEDIUM |

---

## 4.2 Missing Responsive Design

**17 files have ZERO `@media` queries:**

### 🔴 CRITICAL (entire file, no responsive rules at all)
| # | File | Details |
|---|------|---------|
| CSS09 | `Payroll.css` | 4-column KPI grids, wide tables, fixed-width panels — never collapse on mobile |
| CSS10 | `ClockPage.css` | Large clock/button layout likely overflows on mobile |

### 🟠 HIGH (no responsive rules)
| # | File | Details |
|---|------|---------|
| CSS11 | `Timesheets.css` | `.ts-week-grid`, `.ts-summary-grid` stay multi-column on mobile |
| CSS12 | `Invoices.css` | z-index 2000 but zero responsive rules |
| CSS13 | `PerDiemContractor.css` | Per-diem grid never collapses |
| CSS14 | `MyAvailability.css` | Availability grid never collapses |
| CSS15 | `MyHours.css` | Hours entry form doesn't stack |
| CSS16 | `ClientDashboard.css` | KPI grids don't collapse |
| CSS17 | `ClientInvoices.css` | Invoice table doesn't collapse |
| CSS18 | `ClientWorkers.css` | Worker cards don't stack |
| CSS19 | `ClientProjects.css` | Project cards don't stack |

### 🟡 MEDIUM (partial/incomplete responsive)
| # | File | Details |
|---|------|---------|
| CSS20 | `Settings.css:729` | Only `@media (max-width: 640px)` — missing intermediate breakpoints |
| CSS21 | `Matching.css:426` | Only `@media (max-width: 700px)` — missing 480px |
| CSS22 | `WorkerDetail.css:608-615` | Missing 480px breakpoint for tabs |
| CSS23 | `ShiftChangesAdmin.css:12` | Only `@media (max-width: 720px)` |
| CSS24 | `Availability.css:33` | Only `@media (max-width: 640px)` — missing tablet |
| CSS25 | `Reports.css:120-125` | Has 900px and 560px but chart/filters don't collapse between |
| CSS26 | `Dashboard.css` (partial) | Some responsive but incomplete |

**Fix for CSS09-CSS19:** Add breakpoints at 1024px (tablet), 768px (small tablet), 480px (phone):
```css
/* Standard responsive breakpoints */
@media (max-width: 1024px) { /* 2-column grids */ }
@media (max-width: 768px) { /* 1-column grids, collapsed tables */ }
@media (max-width: 480px) { /* stacked everything, hidden non-essential */ }
```

---

## 4.3 Hardcoded Colors (CSS Variable Violations)

**33 instances** of hardcoded colors instead of CSS variables:

| # | File:Line | Hardcoded | Should Use |
|---|-----------|-----------|------------|
| CSS27 | `modals.css:360-366` | `#3380AD, #2A6C95, #1E5270` | `var(--color-primary)` variants |
| CSS28 | `modals.css:139` | `#08543D, #2A6C95, #3A8BC0` | `var(--color-secondary), var(--color-primary)` |
| CSS29 | `modals.css:150` | `#EF4444, #DC2626` | `var(--error)` |
| CSS30 | `modals.css:656` | `#2A6C95` | `var(--color-primary)` |
| CSS31 | `Accounting.css:33,50-51,116-120` | `--border-color, --bg-primary, --text-primary` (**UNDEFINED** — fallbacks always apply) | 🔴 Use existing tokens: `--border, --bg-card, --text` |
| CSS32 | `Accounting.css:812-813` | `#EFF6FF, #2A6C95` | `var(--color-primary)` tinted |
| CSS33 | `Dashboard.css:20` | `#0D9488` (teal) | `var(--color-primary)` or add teal token |
| CSS34 | `Dashboard.css:80-83` | `#2DB84N` (**not in design system**) | `var(--success)` or add token |
| CSS35 | `Dashboard.css:87-92,270-271` | `#2DB84B, #0D9488, #166534` | `var(--success), var(--color-secondary)` |
| CSS36 | `Dashboard.css:408,411` | `#EA580C, #059669` | `var(--warning), var(--success)` |
| CSS37 | `Dashboard.css:432,1064,1096` | `#2A6C95`, gradient variants | `var(--color-primary)` |
| CSS38 | `Workers.css:79,107-108` | `#2A6C95` | `var(--color-primary)` |
| CSS39 | `Workers.css:117,125` | `#EFF6FF, #DC2626` | `var(--hover), var(--error)` |
| CSS40 | `Workers.css:172-175` | `#2A6C95, #EFF6FF` | `var(--color-primary), var(--hover)` |
| CSS41 | `Workers.css:214-231` | `#2A6C95, #059669, #08543D, #D97706` | `var(--color-primary), var(--success), var(--color-secondary), var(--warning)` |
| CSS42 | `Workers.css:382,557,576` | `#2A6C95, #2A6C95→#10B981` | `var(--color-primary), var(--success)` |
| CSS43 | `Workers.css:746-749` | `#2A6C95, #DBEAFE, #EFF6FF` | `var(--color-primary)` variants |
| CSS44 | `Workers.css:901-907` | `#2A6C95, #EFF6FF` | `var(--color-primary), var(--hover)` |
| CSS45 | `InvoicePrint.css:6-11` | **Own `:root` block** with `#08543D, #2A6C95` — duplicating globals.css | Remove `:root`, use `var(--color-primary)` |
| CSS46 | `InvoicePrint.css:76-79` | `#059669, #2A6C95, #08543D` | `var(--success), var(--color-primary), var(--color-secondary)` |
| CSS47 | `VoucherPrint.css:49,65` | `#08543D, #d1d5db` | `var(--color-secondary), var(--border)` |
| CSS48 | `VoucherPrint.css:284-286` | `#6D1ED4, #08543D, #2A6C95` | `var(--color-secondary), var(--color-primary)` |
| CSS49 | `globals.css:530` | `#2A6C95` in `*:focus-visible` | `var(--color-primary)` |
| CSS50 | `globals.css:588-595` | `#2A6C95` in `.wf-input:focus` etc. | `var(--color-primary)` |
| CSS51 | `globals.css:610-615` | `#CBD5E1, #94A3B8` for scrollbar | `var(--text-secondary), var(--text-faint)` |
| CSS52 | `globals.css:649-676` | Badge colors `#D1FAE5/#065F46`, `#FEF3C7/#92400E` | `var(--success), var(--warning)` etc. |
| CSS53 | `globals.css:680-681` | `.badge-live` uses `#EF4444` | `var(--error)` |
| CSS54 | `Login.css:14,45` | Background `#0a1628` | Special case, acceptable |
| CSS55 | `Login.css:54` | Gradient `rgba(8,12,24,0.80)`/`rgba(42,108,149,0.50)` | Could use `var(--color-primary)` with opacity |
| CSS56 | `Login.css:370,393` | `accent-color: #2A6C95`, button `#2A6C95/#1E5270` | `var(--color-primary)` |
| CSS57 | `Accounting.css:362` | `ac-btn-outline-pdf` uses `var(--bg-secondary, #F9FAFB)` — `--bg-secondary` undefined | `var(--hover)` |
| CSS58 | `Accounting.css:1086` | Dark mode hardcoded `#1F2937` instead of `var(--bg-card)` | `var(--bg-card)` |
| CSS59 | `Accounting.css:1821-1827` | Dark mode hardcoded `#1F2937, #374151, #F9FAFB` | `var(--bg-card), var(--border), var(--text)` |

---

## 4.4 Accessibility Issues (Font Size & Contrast)

**21 instances** of fonts below minimum readable size:

| # | File:Line | Current Size | Minimum | Impact |
|---|-----------|-------------|---------|--------|
| CSS60 | `globals.css:457-458` — `.ds-title-row .ds-title` | **0.72rem (~10.8px)** with `!important` | 12px (0.75rem) | 🟠 HIGH |
| CSS61 | `modals.css:570` — `.hmcs-label` | **11px** with `!important` | 12px | 🟠 HIGH |
| CSS62 | `modals.css:205` — `.hmcs-modal-subtitle` | **12px** | 12px | 🟡 MEDIUM |
| CSS63 | `modals.css:648,653-654` — `.hmcs-modal-identity__meta` | **12px, 11px** | 12px | 🟡 MEDIUM |
| CSS64 | `globals.css:529-533` — `:focus-visible` outline | `#2A6C95` insufficient contrast on dark | Higher contrast | 🟠 HIGH |
| CSS65 | `Login.css:280-282` — label | **0.72rem** on `rgba(255,255,255,0.65)` | 0.75rem, 0.85 opacity | 🟠 HIGH |
| CSS66 | `Login.css:496` — `.login-demo__label` | **0.68rem (~9.5px)** | 0.72rem | 🟠 HIGH |
| CSS67 | `Workers.css:242` — `.workers-stat-card__label` | **12px** | Acceptable | 🟡 MEDIUM |
| CSS68 | `Workers.css:566` — `.worker-card__stat-text` | **11px** | 12px | 🟡 MEDIUM |
| CSS69 | `Workers.css:599,900-901` | **11px** badges and section titles | 12px | 🟡 MEDIUM |
| CSS70 | `Workers.css:928-938` | **12px** labels, **11px** hints | 11px min | 🟡 MEDIUM |
| CSS71 | `Accounting.css:257-259` — `.pl-section-label` | **10px (~9px)** | 11px | 🟠 HIGH |
| CSS72 | `Accounting.css:599-601` — `.ac-cf-label` | **10px, 11px** | 11px | 🟡 MEDIUM |
| CSS73 | `InvoicePrint.css:129` — table header | **9px** | 11px | 🟠 HIGH |
| CSS74 | `InvoicePrint.css:172,430-433` — `.bill-to-label` | **10px** | 11px | 🟡 MEDIUM |
| CSS75 | `VoucherPrint.css:97-98` — `.vp-label-sm` | **10px** | 11px | 🟡 MEDIUM |
| CSS76 | `VoucherPrint.css:174` — `.vp-cell-label` | **9px (~7.5px printed)** | 11px | 🟠 HIGH |
| CSS77 | `VoucherPrint.css:213` — `.vp-col-title` | **10px** | 11px | 🟡 MEDIUM |
| CSS78 | `VoucherPrint.css:232` — `.vp-table th` | **10px** | 11px | 🟡 MEDIUM |
| CSS79 | `Dashboard.css:325` — `.ds-card__swap-hint` | **0.65rem (~9.75px)** | 0.72rem | 🟠 HIGH |
| CSS80 | `Dashboard.css:356` — `.ds-size-btn` | **0.63rem (~9.45px)** | 0.72rem | 🟠 HIGH |
| CSS81 | `Dashboard.css:455,494` — `.ds-badge`, `.ds-worker__av` | **0.68rem, 0.65rem** | 0.72rem | 🟡 MEDIUM |

**Fix for CSS60-CSS81:** Global minimum font size enforcement:
```css
/* Add to globals.css */
:root {
  --font-size-min: 0.75rem; /* 12px */
  --font-size-sm: 0.75rem;  /* was 0.72rem */
  --font-size-xs: 0.6875rem; /* 11px — absolute minimum */
}
/* Search/replace all hardcoded font-size values below 0.6875rem */
```

---

## 4.5 Z-Index Stack Conflicts

**No documented z-index scale.** Values range from 0 to 9999 with no coordination:

| # | File:Line | Current | Problem |
|---|-----------|---------|---------|
| CSS82 | `Workers.css:783` — `.workers-modal-overlay` | **1000** | Above unified modal overlay (500) |
| CSS83 | `Timesheets.css:800` | **2000** | Above everything |
| CSS84 | `Invoices.css:839` | **2000** | Same |
| CSS85 | `Matching.css:419` | **2000** | Same |
| CSS86 | `Availability.css:432` | **2000** | Same |
| CSS87 | `Documents.css:632` | **2000** | Same |
| CSS88 | `WorkerDetail.css:259` | **9999** | Toast-level but not toasts |
| CSS89 | `Performance.css:291` | **1000** | Same as CSS01 |
| CSS90 | `ShiftChangesAdmin.css:277` | **1000** | Same |
| CSS91 | `MyPayments.css:188` | **1000** | Same |
| CSS92 | `Performance.css:341`, `AssignmentHistory.css:341`, `Payroll.css:311` | **9999** | FAB buttons at toast level |

**Fix for CSS82-CSS92:** Define z-index scale in `globals.css`:
```css
:root {
  --z-sidebar: 100;
  --z-header: 200;
  --z-dropdown: 300;
  --z-drawer-overlay: 400;
  --z-drawer: 401;
  --z-modal-overlay: 500;
  --z-modal: 501;
  --z-tooltip: 700;
  --z-toast: 9000;
}
```

---

## 4.6 Print Style Problems

| # | File:Line | Issue | Impact |
|---|-----------|-------|--------|
| CSS93 | `InvoicePrint.css:379-385` | `body * { visibility: hidden }` fragile pattern; missing `@page { size: letter; margin: 0.5in; }` | 🟠 HIGH |
| CSS94 | `InvoicePrint.css:379-385` | No `page-break-inside: avoid` on table rows → multi-page invoices break mid-row | 🟠 HIGH |
| CSS95 | `InvoicePrint.css:395` | `.ip-doc__paid-stamp` `opacity: 0.15` — nearly invisible when printed | 🟡 MEDIUM |
| CSS96 | `VoucherPrint.css:408-409` | `visibility: visible !important` depends on InvoicePrint's pattern | 🟠 HIGH |
| CSS97 | `VoucherPrint.css:410-425` | Missing `@page` rule; no `page-break-inside: avoid` on table rows/payment panels | 🟠 HIGH |
| CSS98 | `InvoicePrint.css:13-14` | `body { background-color: #f1f5f9 }` bleeds into print | 🟡 MEDIUM |
| CSS99 | `InvoicePrint.css:25-36,86-112` | Toolbar/mods not wrapped in `@media screen` | 🔵 LOW |

**Fix for CSS93-CSS99:**
```css
/* In both InvoicePrint.css and VoucherPrint.css */
@page {
  size: letter;
  margin: 0.4in 0.5in;
}

@media print {
  .no-print { display: none !important; }
  body { background: white !important; }
  table tr, .ip-doc__totals, .ip-doc__footer,
  .vp-table tr, .vp-pay-row, .vp-voucher {
    page-break-inside: avoid;
  }
}
```

---

## 4.7 Design System Duplications

| # | File:Line | Issue | Impact |
|---|-----------|-------|--------|
| CSS100 | `modals.css:360-366` | Duplicates `.btn-primary` from `globals.css:297-304` (gradient vs solid) | 🟠 HIGH |
| CSS101 | `modals.css:406-428` | Duplicates `.btn-outline` from `globals.css:315-323` | 🟠 HIGH |
| CSS102 | `modals.css:431-453` | Duplicates `.btn-danger` from `globals.css:325-332` | 🟠 HIGH |
| CSS103 | `Accounting.css:1749-1771` | RE-defines `.btn-primary` THIRD time with `#2563EB` (blue vs teal) | 🔴 CRITICAL |
| CSS104 | `Accounting.css:1773-1790` | RE-defines `.btn-secondary` conflicting with global | 🟠 HIGH |
| CSS105 | `Workers.css:73-99` | `.workers-btn-primary` duplicates modals.css button style | 🟠 HIGH |
| CSS106 | `InvoicePrint.css:6-11` | Own `:root` block duplicating globals with different names (`--hmcs-green`) | 🟡 MEDIUM |
| CSS107 | `Dashboard.css:189-193` | Own shadow system instead of `var(--shadow-card)` | 🟡 MEDIUM |
| CSS108 | `Dashboard.css:1064` | `.ds-toggle--on` `#2A6C95` — already defined via `--color-primary` | 🔵 LOW |
| CSS109 | `Workers.css:1780` | Dark mode uses `#60A5FA` (blue) instead of `var(--color-primary)` | 🟡 MEDIUM |
| CSS110 | `Accounting.css:397` | `box-shadow: 0 2px 8px rgba(0,0,0,.05)` instead of `var(--shadow-md)` | 🔵 LOW |

---

# 5. CROSS-CUTTING ISSUES

| # | Issue | Files Affected | Impact |
|---|-------|----------------|--------|
| X01 | **No i18n (Spanish/English)** — required by Libro 1, not implemented anywhere | Entire project | 🟠 HIGH — Core requirement missing |
| X02 | **No Decimal.js** — all financial calcs use raw parseFloat | Every financial calculation across backend + frontend | 🟠 HIGH — Penny-level drift |
| X03 | **Inconsistent API response unwrapping** — `res.data?.data`, `res.data`, `res` used interchangeably | Every frontend page | 🟠 HIGH — Silent breakage if API format changes |
| X04 | **No AbortController** — race conditions on rapid filter changes | Reports.jsx, Timesheets.jsx, Accounting.jsx | 🟡 MEDIUM — Stale responses |
| X05 | **Empty catch blocks** — silent error swallowing | Accounting.jsx (106,119,976), Dashboard.jsx (192), Reports.jsx (1017) | 🟡 MEDIUM — No user feedback |
| X06 | **Index as React key** — `key={i}` in 10+ components | Multiple JSX files | 🔵 LOW — Reconciliation issues on reorder |
| X07 | **`window.confirm()`** used instead of styled modals | Workers.jsx:549, DocumentUploader.jsx:114 | 🔵 LOW — Non-themed blocking |
| X08 | **No loading state on toggle-status** — double-fire risk | Clients.jsx, Projects.jsx, Workers.jsx | 🟡 MEDIUM — Duplicate requests |
| X09 | **Hardcoded `'en-US'` locale** in Spanish-language app | ClockPage.jsx, ContractorDashboard.jsx, MyHours.jsx | 🔵 LOW — Date format mismatch |
| X10 | **`sync({ alter: true })`** in production | backend/server.js:140 | 🟠 HIGH — Column drops on restart |
| X11 | **No request body size limit** | backend/server.js:62 | 🟡 MEDIUM — DoS vector |
| X12 | **Token key mismatch** — `hmcs_token` vs `token` | AdminLayout.jsx, AuthContext.jsx, Payroll.jsx | 🔴 CRITICAL — Auth silently broken |

---

# 6. PRIORITY REPAIR PLAN

## Phase 1 — Immediate (Security & Data Loss)
Estimated effort: 2-3 days

| ID | Bug | File | Effort |
|----|-----|------|--------|
| F49/F50 | Token key mismatch + JWT in SSE URL | AdminLayout.jsx | 1h |
| C01 | SSN unencrypted in DB | workerController.js | 1h |
| F07 | SSN exposed in PDF/CSV exports | Accounting.jsx | 1h |
| F24 | Dashboard widget config lost | Dashboard.jsx | 1h |
| F31 | Client rate changes silently lost | Clients.jsx | 1h |
| F32 | Logo hardcoded to localhost | Clients.jsx | 30min |
| F01/F53 | Screenshot upload hardcoded | Payroll.jsx, PaymentUploadModal.jsx | 30min |
| F40 | Contractor page 403 | ShiftChanges.jsx | 1h |
| F41 | W-9 signature discarded | MyProfile.jsx | 30min |
| F55 | DocumentUploader crash on null | DocumentUploader.jsx | 30min |
| X12 | Token key unification (all files) | Global search/replace | 1h |

## Phase 2 — Financial Accuracy
Estimated effort: 3-4 days

| ID | Bug | File | Effort |
|----|-----|------|--------|
| C04 | gross_pay vs total_to_transfer | payrollController.js | 30min |
| C10 | Transaction Rules OR vs AND | accountingController.js | 30min |
| F25 | Revenue inflated with unpaid | Dashboard.jsx | 30min |
| F26 | Profit margin mislabeled | Dashboard.jsx | 30min |
| F15 | Hours recalculated with 40h cap | Reports.jsx | 1h |
| F16 | Zero treated as falsy | Reports.jsx | 30min |
| X02 | Install Decimal.js + refactor all | All financial files | 2-3 days |
| C08 | Invoice number race condition | invoiceController.js | 2h |
| C11 | MySQL syntax for PostgreSQL | accountingController.js | 1h |
| F03 | netToTransfer missing per_diem | Payroll.jsx | 30min |

## Phase 3 — Functionality
Estimated effort: 2-3 days

| ID | Bug | File | Effort |
|----|-----|------|--------|
| F02 | Voucher route broken | Payroll.jsx + Router | 1h |
| F21 | Invoice draft endpoint 404 | Invoices.jsx | 30min |
| F36 | Week number calculation | Timesheets.jsx | 1h |
| F37 | Overnight shift preview 0.00 | Timesheets.jsx | 30min |
| F27 | Cashflow chart fake data | Dashboard.jsx | 30min |
| F28 | Project progress bars fake | Dashboard.jsx | 30min |
| F34 | UI fields sent to API | Projects.jsx | 30min |
| C05 | Logo hardcoded in voucher | payrollController.js | 30min |
| C18 | alter:true in production | server.js | 5min |
| C06/C07 | Payroll validation/duplicates | payrollController.js | 2h |
| C12-C14 | Accounting pagination/import | accountingController.js | 3h |
| C15-C17 | Time entry GPS/distance | timeEntryController.js | 2h |
| F42 | filterType ignored | DocumentUploader.jsx | 1h |
| F44 | Documents step no validation | MyProfile.jsx | 1h |
| F46/F47 | Client portal bugs | Client pages | 2h |
| F59 | WeekCalendar null crash | WeekCalendar.jsx | 15min |

## Phase 4 — CSS & UI
Estimated effort: 5-7 days

| Area | Details | Effort |
|------|---------|--------|
| Z-index cleanup (CSS82-92) | Define scale, fix all files | 1 day |
| Responsive design (CSS09-26) | Add @media to 17 files | 2-3 days |
| Hardcoded color replacement (CSS27-59) | Replace 33 instances with var() | 1 day |
| Accessibility font sizes (CSS60-81) | Fix 22 size violations | 1 day |
| Print style fixes (CSS93-99) | @page, page-break, .no-print | 4h |
| Design system consolidation (CSS100-110) | Remove duplicate btn defs | 4h |
| Undefined CSS variables (CSS31) | Fix Accounting.css var references | 2h |

## Phase 5 — Code Quality & Architecture
Estimated effort: 3-5 days

| Issue | Details | Effort |
|-------|---------|--------|
| X01 | Implement i18n (Spanish/English) | 2-3 days |
| X03 | Standardize API response unwrapping | 1 day |
| X04 | Add AbortController to all fetches | 1 day |
| X05 | Fix all empty catch blocks | 4h |
| X06 | Replace index-as-key | 2h |
| X07 | Replace window.confirm with modals | 2h |
| X08 | Add loading states to toggles | 2h |
| X09 | Use user locale instead of en-US | 2h |

---

**TOTAL ESTIMATED EFFORT: 15-22 days (3-4 weeks for one developer)**

**IMMEDIATE PRIORITY (Phase 1):** Security & data-loss fixes = 2-3 days. These should be done first before any other work, as they represent legal/financial risk and data corruption.

## Legend

- 🔴 CRITICAL — Security breach, data loss, financial corruption, or completely broken feature
- 🟠 HIGH — Major functionality broken, wrong financial data, performance crash risk
- 🟡 MEDIUM — Feature partially broken, minor data issues, poor UX
- ⚪ LOW — Code smell, cosmetic, minor UX friction
