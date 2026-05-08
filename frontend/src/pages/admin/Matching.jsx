/**
 * Matching.jsx  (Admin)
 * /admin/matching
 * Sugerencias automáticas de worker → proyecto.
 * El admin selecciona un proyecto activo y ve los candidatos rankeados por score.
 * Desde aquí puede asignar directamente un worker al proyecto.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import './Matching.css';

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Helpers ──────────────────────────────────────────────────────────────
const scoreClass = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'mid';
    return 'low';
};

const cardClass = (score) => {
    if (score >= 70) return 'match-card--top';
    if (score >= 40) return 'match-card--mid';
    return 'match-card--low';
};

const availLabel = {
    available:   'Disponible',
    assigned:    'Asignado',
    unavailable: 'No disponible',
};

const fmt12 = (t) => {
    if (!t) return '—';
    const [h, m] = String(t).split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
};

// ─── Score breakdown bars ────────────────────────────────────────────────
const Breakdown = ({ breakdown }) => {
    const bars = [
        { key: 'trade',    label: 'Trade',    max: 40, cls: 'match-bar-fill--trade' },
        { key: 'days',     label: 'Días',     max: 25, cls: 'match-bar-fill--days' },
        { key: 'schedule', label: 'Horario',  max: 20, cls: 'match-bar-fill--schedule' },
        { key: 'status',   label: 'Status',   max: 15, cls: 'match-bar-fill--status' },
    ];
    return (
        <div className="match-breakdown">
            {bars.map(b => (
                <div key={b.key} className="match-bar-row">
                    <span className="match-bar-label">{b.label}</span>
                    <div className="match-bar-track">
                        <div
                            className={`match-bar-fill ${b.cls}`}
                            style={{ width: `${(breakdown[b.key] / b.max) * 100}%` }}
                        />
                    </div>
                    <span className="match-bar-pts">{breakdown[b.key]}/{b.max}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Assign modal ─────────────────────────────────────────────────────────
const AssignModal = ({ project, worker, onClose, onAssigned }) => {
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);

    const handleConfirm = async () => {
        if (!startDate) { setErr('Selecciona una fecha de inicio.'); return; }
        setSaving(true);
        setErr(null);
        try {
            await api.post('/assignments', {
                worker_id:  worker.worker_id,
                project_id: project.id,
                start_date: startDate,
                notes:      notes || null,
                status:     'active',
            });
            onAssigned(worker.worker_id);
            onClose();
        } catch (e) {
            setErr(e.response?.data?.message || 'Error al crear la asignación.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="match-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="match-modal">
                <div className="match-modal__header">
                    <h2 className="match-modal__title">Asignar worker</h2>
                    <button className="match-modal__close" onClick={onClose}>✕</button>
                </div>

                <div className="match-modal__body">
                    <div className="match-modal__info">
                        Asignando <strong>{worker.first_name} {worker.last_name}</strong>
                        {' '}al proyecto <strong>{project.name}</strong>.
                        {worker.client_rate && (
                            <> Tarifa del cliente: <strong>${worker.client_rate}/hr</strong>.</>
                        )}
                    </div>

                    <div className="match-form-row">
                        <label className="match-form-label">Fecha de inicio</label>
                        <input
                            type="date"
                            className="match-form-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <div className="match-form-row">
                        <label className="match-form-label">Notas (opcional)</label>
                        <textarea
                            className="match-form-input"
                            rows={2}
                            placeholder="Notas sobre la asignación…"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            style={{ resize: 'none', fontFamily: 'inherit' }}
                        />
                    </div>

                    {err && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0 }}>{err}</p>}
                </div>

                <div className="match-modal__footer">
                    <button className="match-modal__btn match-modal__btn--cancel" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button className="match-modal__btn match-modal__btn--confirm" onClick={handleConfirm} disabled={saving}>
                        {saving ? 'Asignando…' : 'Confirmar asignación'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Candidate card ───────────────────────────────────────────────────────
const CandidateCard = ({ candidate, project, onAssign }) => {
    const sc = scoreClass(candidate.score);

    return (
        <div className={`match-card ${cardClass(candidate.score)}`}>
            {/* Score ring */}
            <div className="match-score">
                <div className={`match-score__ring match-score__ring--${sc}`}>
                    {candidate.score}
                </div>
                <span className="match-score__label">/ 100</span>
            </div>

            {/* Worker info */}
            <div className="match-worker">
                <p className="match-worker__name">
                    {candidate.first_name} {candidate.last_name}
                    <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                        {candidate.worker_code}
                    </span>
                </p>
                <div className="match-worker__meta">
                    <span className={`match-worker__trade ${candidate.trade_match ? 'match-worker__trade--match' : ''}`}>
                        {candidate.trade_match ? '✓ ' : ''}{candidate.trade_name ?? 'Sin trade'}
                    </span>
                    <span className={`match-avail-badge match-avail-badge--${candidate.availability}`}>
                        {availLabel[candidate.availability]}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {candidate.days_coverage}% días cubiertos
                    </span>
                </div>
            </div>

            {/* Score breakdown */}
            <Breakdown breakdown={candidate.score_breakdown} />

            {/* Actions */}
            <div className="match-actions">
                <button
                    className="match-btn-assign"
                    onClick={() => onAssign(candidate)}
                    disabled={candidate.availability === 'unavailable'}
                >
                    Asignar
                </button>
                {candidate.client_rate != null && (
                    <span className="match-rate-info">${candidate.client_rate}/hr (cliente)</span>
                )}
                {candidate.hourly_rate != null && (
                    <span className="match-rate-info">${candidate.hourly_rate}/hr (worker)</span>
                )}
            </div>
        </div>
    );
};

// ─── Página principal ──────────────────────────────────────────────────────
const Matching = () => {
    const [projects, setProjects] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [result, setResult] = useState(null);      // { project, candidates }
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');     // all | match | available
    const [assigning, setAssigning] = useState(null); // candidate being assigned
    const [toast, setToast] = useState(null);
    const [assignedIds, setAssignedIds] = useState(new Set()); // IDs asignados en esta sesión

    const showToast = (ok, msg) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3500);
    };

    // Cargar proyectos activos para el selector
    useEffect(() => {
        api.get('/matching/projects')
            .then(r => setProjects(r.data?.data ?? []))
            .catch(() => {});
    }, []);

    // Cargar candidatos cuando cambia el proyecto
    const loadCandidates = useCallback(async (id) => {
        if (!id) return;
        setLoading(true);
        setResult(null);
        setAssignedIds(new Set());
        try {
            const r = await api.get(`/matching/project/${id}`);
            setResult(r.data?.data ?? null);
        } catch {
            showToast(false, 'Error al cargar candidatos');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleProjectChange = (e) => {
        const id = e.target.value;
        setSelectedId(id);
        setFilter('all');
        loadCandidates(id);
    };

    const handleAssigned = (workerId) => {
        setAssignedIds(prev => new Set([...prev, workerId]));
        showToast(true, 'Worker asignado correctamente al proyecto');
        // Refrescar candidatos para excluir el recién asignado
        loadCandidates(selectedId);
    };

    // Filtrar candidatos
    const candidates = (result?.candidates ?? []).filter(c => {
        if (assignedIds.has(c.worker_id)) return false;
        if (filter === 'match') return c.trade_match;
        if (filter === 'available') return c.availability === 'available';
        return true;
    });

    const tradeMatchCount = (result?.candidates ?? []).filter(c => c.trade_match).length;
    const availableCount  = (result?.candidates ?? []).filter(c => c.availability === 'available').length;

    return (
        <div className="match-page">
            <div className="match-header">
                <h1 className="match-header__title">Matching Worker → Proyecto</h1>
                <p className="match-header__subtitle">
                    Selecciona un proyecto activo para ver los workers más compatibles, rankeados por score automático.
                </p>
            </div>

            {/* Selector de proyecto */}
            <div className="match-selector">
                <div style={{ flex: 1, minWidth: 260 }}>
                    <span className="match-selector__label">Proyecto</span>
                    <select
                        className="match-selector__select"
                        value={selectedId}
                        onChange={handleProjectChange}
                    >
                        <option value="">— Selecciona un proyecto —</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} · {p.client_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Info del proyecto seleccionado */}
            {result?.project && (
                <div className="match-project-card">
                    <div>
                        <p className="match-project-card__name">{result.project.name}</p>
                        <p className="match-project-card__client">{result.project.client_name}</p>
                    </div>
                    <div className="match-project-card__meta">
                        <div className="match-meta-item">
                            <span className="match-meta-item__label">Turno</span>
                            <span className="match-meta-item__value">
                                {result.project.shift_start_time
                                    ? `${fmt12(result.project.shift_start_time)} – ${fmt12(result.project.shift_end_time)}`
                                    : 'No definido'}
                            </span>
                        </div>
                        <div className="match-meta-item">
                            <span className="match-meta-item__label">Ya asignados</span>
                            <span className="match-meta-item__value">{result.project.already_assigned} workers</span>
                        </div>
                        <div className="match-meta-item">
                            <span className="match-meta-item__label">Trades aceptados</span>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                                {result.project.accepted_trades.map(t => (
                                    <span key={t.trade_id} className="match-trade-pill">
                                        {t.trade_name} · ${t.hourly_rate}/hr
                                    </span>
                                ))}
                                {result.project.accepted_trades.length === 0 && (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sin tarifas configuradas</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && <div className="match-loading">Calculando compatibilidad…</div>}

            {/* Resultados */}
            {!loading && result && (
                <>
                    <div className="match-summary">
                        <span className="match-summary__count">
                            <strong>{candidates.length}</strong> candidatos
                            {filter !== 'all' && ` (filtrado)`}
                            {result.total > 0 && ` · ${tradeMatchCount} con trade exacto · ${availableCount} disponibles`}
                        </span>
                        <div className="match-filter-tabs">
                            {[
                                { key: 'all',       label: `Todos (${result.candidates.length})` },
                                { key: 'match',     label: `Trade match (${tradeMatchCount})` },
                                { key: 'available', label: `Disponibles (${availableCount})` },
                            ].map(f => (
                                <button
                                    key={f.key}
                                    className={`match-filter-tab${filter === f.key ? ' match-filter-tab--active' : ''}`}
                                    onClick={() => setFilter(f.key)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="match-list">
                        {candidates.length === 0 && (
                            <div className="match-empty">No hay candidatos con esos filtros.</div>
                        )}
                        {candidates.map(c => (
                            <CandidateCard
                                key={c.worker_id}
                                candidate={c}
                                project={result.project}
                                onAssign={setAssigning}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Placeholder inicial */}
            {!loading && !result && !selectedId && (
                <div className="match-placeholder">
                    <div className="match-placeholder__icon">🎯</div>
                    <p>Selecciona un proyecto para ver los mejores candidatos.</p>
                </div>
            )}

            {/* Modal de asignación */}
            {assigning && result?.project && (
                <AssignModal
                    project={result.project}
                    worker={assigning}
                    onClose={() => setAssigning(null)}
                    onAssigned={handleAssigned}
                />
            )}

            {toast && (
                <div className={`match-toast match-toast--${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>
            )}
        </div>
    );
};

export default Matching;
