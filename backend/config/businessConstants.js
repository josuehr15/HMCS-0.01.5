/**
 * DEUDA-001: Named business-rule constants.
 * These are the compile-time defaults. Runtime values come from company_settings table.
 * Never hardcode these numbers directly in controllers — always read from DB or this file.
 */

// Overtime threshold: hours per week before overtime kicks in
const STANDARD_HOURS_PER_WEEK = 40;

// Default overtime multiplier (1.5x) — overridden per client via client_rates.overtime_multiplier
const DEFAULT_OT_MULTIPLIER = 1.5;

// GPS validation radius in meters — overridden per project via projects.gps_radius_meters
const DEFAULT_GPS_RADIUS_METERS = 500;

// Payroll frequency in days
const PAYROLL_PERIOD_DAYS = 7;

module.exports = {
    STANDARD_HOURS_PER_WEEK,
    DEFAULT_OT_MULTIPLIER,
    DEFAULT_GPS_RADIUS_METERS,
    PAYROLL_PERIOD_DAYS,
};
