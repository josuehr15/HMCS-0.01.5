import { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileText, FileImage, Search, Download, Trash2, Loader,
    Upload, User, Building2, Briefcase, RefreshCw,
    Clock, ShieldCheck, XCircle, AlertCircle,
    ChevronDown, ChevronRight, FolderOpen, Folder, Eye, X,
    ZoomIn, ZoomOut, RotateCw,
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import DocumentUploader from '../../components/DocumentUploader';
import { API_URL } from '../../utils/api';
import './Documents.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
const DOC_TYPE_LABELS = {
    id_photo:       { label: 'Foto de ID',       color: 'blue'   },
    ssn_photo:      { label: 'Foto de SSN',       color: 'purple' },
    w9:             { label: 'W-9',               color: 'orange' },
    contract:       { label: 'Contrato',          color: 'green'  },
    insurance_cert: { label: 'Cert. Seguro',      color: 'teal'   },
    other:          { label: 'Otro',              color: 'gray'   },
};

const OWNER_TYPE_CONFIG = {
    worker:  { label: 'Trabajadores', Icon: User,      color: '#059669', bg: 'rgba(5,150,105,0.1)'   },
    client:  { label: 'Clientes',     Icon: Building2, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
    company: { label: 'Empresa',      Icon: Briefcase, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
};

const STAT_COLORS = {
    total:   '#2a6c95',
    workers: '#059669',
    clients: '#3b82f6',
    company: '#8b5cf6',
};

function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' });
}

function fileGradient(mimeType) {
    if (mimeType?.startsWith('image/'))          return 'linear-gradient(135deg,#f59e0b,#d97706)';
    if (mimeType === 'application/pdf')           return 'linear-gradient(135deg,#ef4444,#dc2626)';
    if (mimeType?.includes('word'))               return 'linear-gradient(135deg,#3b82f6,#2563eb)';
    return 'linear-gradient(135deg,#6b7280,#4b5563)';
}

function FileIcon({ mimeType, size = 13 }) {
    if (mimeType?.startsWith('image/')) return <FileImage size={size} />;
    return <FileText size={size} />;
}

// ─── Can preview? ─────────────────────────────────────────────────────────────
function canPreview(mimeType) {
    if (!mimeType) return false;
    return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
const PreviewModal = ({ doc, onClose }) => {
    const [blobUrl, setBlobUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [zoom, setZoom] = useState(1);
    const [rotate, setRotate] = useState(0);
    const isImage = doc.mime_type?.startsWith('image/');
    const isPdf   = doc.mime_type === 'application/pdf';

    useEffect(() => {
        let url = null;
        (async () => {
            try {
                const token = localStorage.getItem('hmcs_token');
                const BASE = API_URL;
                const res = await fetch(`${BASE}/documents/${doc.id}/download`, {
                    credentials: 'include',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error('No se pudo cargar el archivo');
                const blob = await res.blob();
                url = URL.createObjectURL(blob);
                setBlobUrl(url);
            } catch (e) {
                setError(e.message || 'Error al cargar el archivo');
            } finally {
                setLoading(false);
            }
        })();
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [doc.id]);

    // Close on Escape
    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="docs-preview-overlay" onClick={onClose}>
            <div className="docs-preview-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="docs-preview-header">
                    <div className="docs-preview-title-wrap">
                        <div className="docs-preview-file-icon" style={{ background: fileGradient(doc.mime_type) }}>
                            <FileIcon mimeType={doc.mime_type} size={13} />
                        </div>
                        <div>
                            <div className="docs-preview-filename">{doc.document_name}</div>
                            <div className="docs-preview-meta">{formatBytes(doc.file_size)}</div>
                        </div>
                    </div>
                    <div className="docs-preview-toolbar">
                        {isImage && (
                            <>
                                <button className="docs-preview-tool" onClick={() => setZoom(z => Math.min(z + 0.25, 3))} title="Acercar">
                                    <ZoomIn size={15} />
                                </button>
                                <button className="docs-preview-tool" onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} title="Alejar">
                                    <ZoomOut size={15} />
                                </button>
                                <button className="docs-preview-tool" onClick={() => setRotate(r => (r + 90) % 360)} title="Rotar">
                                    <RotateCw size={15} />
                                </button>
                            </>
                        )}
                        <button className="docs-preview-tool" onClick={() => blobUrl && downloadDoc(doc)} title="Descargar">
                            <Download size={15} />
                        </button>
                        <button className="docs-preview-close" onClick={onClose} title="Cerrar (Esc)">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="docs-preview-body">
                    {loading && (
                        <div className="docs-preview-loading">
                            <Loader size={24} className="docs-spin" />
                            <span>Cargando archivo...</span>
                        </div>
                    )}
                    {error && (
                        <div className="docs-preview-error">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}
                    {blobUrl && isPdf && (
                        <iframe
                            className="docs-preview-iframe"
                            src={blobUrl}
                            title={doc.document_name}
                        />
                    )}
                    {blobUrl && isImage && (
                        <div className="docs-preview-img-wrap">
                            <img
                                className="docs-preview-img"
                                src={blobUrl}
                                alt={doc.document_name}
                                style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}
                                draggable={false}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Download helper ──────────────────────────────────────────────────────────
async function downloadDoc(doc) {
    try {
        const token = localStorage.getItem('hmcs_token');
        const BASE = API_URL;
        const res = await fetch(`${BASE}/documents/${doc.id}/download`, {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', doc.document_name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch { /* silencioso */ }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, icon: Icon, color }) => (
    <div className="docs-stat" style={{ '--docs-stat-color': color }}>
        <div className="docs-stat__icon" style={{ background: `${color}18`, color }}>
            <Icon size={18} />
        </div>
        <div className="docs-stat__body">
            <div className="docs-stat__val">{value}</div>
            <div className="docs-stat__label">{label}</div>
        </div>
    </div>
);

// ─── Single document row inside a folder ─────────────────────────────────────
const DocFileRow = ({ doc, onDelete }) => {
    const typeInfo = DOC_TYPE_LABELS[doc.document_type] || DOC_TYPE_LABELS.other;
    const [deleting, setDeleting] = useState(false);
    const [previewing, setPreviewing] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`¿Eliminar "${doc.document_name}"?`)) return;
        setDeleting(true);
        await onDelete(doc.id);
        setDeleting(false);
    };

    return (
        <>
            <div className="docs-file-row">
                <div className="docs-file-row__icon" style={{ background: fileGradient(doc.mime_type) }}>
                    <FileIcon mimeType={doc.mime_type} size={12} />
                </div>
                <div className="docs-file-row__info">
                    <span className="docs-file-row__name" title={doc.document_name}>
                        {doc.document_name.length > 38 ? doc.document_name.substring(0, 38) + '…' : doc.document_name}
                    </span>
                    <span className="docs-file-row__meta">
                        {formatBytes(doc.file_size)}
                        {doc.uploader?.email ? ` · ${doc.uploader.email}` : ''}
                        {' · '}{formatDate(doc.created_at)}
                    </span>
                </div>
                <span className={`docs-badge docs-badge--${typeInfo.color}`}>{typeInfo.label}</span>
                <div className="docs-file-row__actions">
                    {canPreview(doc.mime_type) && (
                        <button className="docs-btn docs-btn--view" onClick={() => setPreviewing(true)} title="Ver archivo">
                            <Eye size={13} />
                        </button>
                    )}
                    <button className="docs-btn docs-btn--dl" onClick={() => downloadDoc(doc)} title="Descargar">
                        <Download size={13} />
                    </button>
                    <button className="docs-btn docs-btn--del" onClick={handleDelete} disabled={deleting} title="Eliminar">
                        {deleting ? <Loader size={13} className="docs-spin" /> : <Trash2 size={13} />}
                    </button>
                </div>
            </div>
            {previewing && <PreviewModal doc={doc} onClose={() => setPreviewing(false)} />}
        </>
    );
};

// ─── Owner "Folder" card ──────────────────────────────────────────────────────
const OwnerFolder = ({ ownerType, ownerName, ownerId, docs, onDelete, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    const cfg = OWNER_TYPE_CONFIG[ownerType] || OWNER_TYPE_CONFIG.company;
    const Icon = cfg.Icon;

    const initials = ownerName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() || '')
        .join('');

    return (
        <div className={`docs-folder ${open ? 'docs-folder--open' : ''}`}>
            {/* Folder header — clickable */}
            <button className="docs-folder__header" onClick={() => setOpen(o => !o)}>
                <div className="docs-folder__avatar" style={{ background: cfg.bg, color: cfg.color }}>
                    {ownerType === 'company' ? <Icon size={16} /> : initials || <Icon size={16} />}
                </div>
                <div className="docs-folder__title-wrap">
                    <span className="docs-folder__name">{ownerName}</span>
                    <span className="docs-folder__meta">
                        <span className={`docs-badge docs-badge--${ownerType === 'worker' ? 'green' : ownerType === 'client' ? 'blue' : 'purple'}`}>
                            <Icon size={10} /> {cfg.label}
                        </span>
                        <span className="docs-folder__count">{docs.length} {docs.length === 1 ? 'archivo' : 'archivos'}</span>
                    </span>
                </div>
                <div className="docs-folder__chevron">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </button>

            {/* Folder body */}
            {open && (
                <div className="docs-folder__body">
                    {docs.map(doc => (
                        <DocFileRow key={doc.id} doc={doc} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────
const UploadModal = ({ onClose }) => (
    <div className="docs-modal-overlay" onClick={onClose}>
        <div className="docs-modal" onClick={e => e.stopPropagation()}>
            <div className="docs-modal__header">
                <h3 className="docs-modal__title">Subir documento de empresa</h3>
                <button className="docs-modal__close" onClick={onClose}>×</button>
            </div>
            <div className="docs-modal__body">
                <DocumentUploader ownerType="company" ownerId={null} />
            </div>
        </div>
    </div>
);

// ─── Audit row ────────────────────────────────────────────────────────────────
const AuditRow = ({ doc }) => {
    const typeInfo = DOC_TYPE_LABELS[doc.document_type] || DOC_TYPE_LABELS.other;
    const ownerCfg = OWNER_TYPE_CONFIG[doc.owner_type] || OWNER_TYPE_CONFIG.company;
    const OwnerIcon = ownerCfg.Icon;
    const isDeleted = !doc.is_active;

    return (
        <tr className={`docs-row ${isDeleted ? 'docs-row--deleted' : ''}`}>
            <td className="docs-td docs-td--name">
                <span className="docs-file-icon-sm" style={{ background: fileGradient(doc.mime_type) }}>
                    <FileIcon mimeType={doc.mime_type} size={12} />
                </span>
                <div>
                    <div className="docs-filename">
                        {doc.document_name.length > 34 ? doc.document_name.substring(0, 34) + '…' : doc.document_name}
                    </div>
                    <div className="docs-filesize">{formatBytes(doc.file_size)}</div>
                </div>
            </td>
            <td className="docs-td">
                <span className={`docs-badge docs-badge--${typeInfo.color}`}>{typeInfo.label}</span>
            </td>
            <td className="docs-td">
                <span className={`docs-badge docs-badge--${ownerCfg.color === '#059669' ? 'green' : ownerCfg.color === '#3b82f6' ? 'blue' : 'purple'}`}>
                    <OwnerIcon size={10} /> {doc.owner_name || `${ownerCfg.label} #${doc.owner_id || ''}`}
                </span>
            </td>
            <td className="docs-td docs-td--date">
                <div>{formatDateTime(doc.created_at)}</div>
                <div className="docs-audit-by">{doc.uploader?.email || '—'}</div>
            </td>
            <td className="docs-td docs-td--date">
                {isDeleted ? (
                    <>
                        <div>{formatDateTime(doc.deleted_at)}</div>
                        <div className="docs-audit-by">{doc.deleter?.email || '—'}</div>
                    </>
                ) : <span className="docs-badge docs-badge--green"><ShieldCheck size={10} /> Activo</span>}
            </td>
            <td className="docs-td">
                {isDeleted
                    ? <span className="docs-badge docs-badge--red"><XCircle size={10} /> Eliminado</span>
                    : <span className="docs-badge docs-badge--green"><ShieldCheck size={10} /> Activo</span>}
            </td>
        </tr>
    );
};

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = ({ filtered }) => (
    <div className="docs-empty">
        <FolderOpen size={40} />
        <div className="docs-empty__title">
            {filtered ? 'Sin resultados para los filtros aplicados' : 'No hay documentos subidos aún'}
        </div>
        <div className="docs-empty__sub">
            {filtered
                ? 'Intenta cambiar los filtros de búsqueda.'
                : 'Los documentos aparecerán aquí cuando los trabajadores o administradores los suban.'}
        </div>
    </div>
);

// ─── Error banner ─────────────────────────────────────────────────────────────
const ErrorBanner = ({ message, onRetry }) => (
    <div className="docs-error-banner">
        <AlertCircle size={16} />
        <span>{message}</span>
        {onRetry && <button className="docs-error-retry" onClick={onRetry}>Reintentar</button>}
    </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Documents() {
    const { get, del } = useApi();
    const [tab, setTab] = useState('active');
    const [docs, setDocs] = useState([]);
    const [auditDocs, setAuditDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [auditLoading, setAuditLoading] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filterOwner, setFilterOwner] = useState('all');  // all | worker | client | company
    const [showUpload, setShowUpload] = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchDocs = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await get('/documents');
            const raw = res?.data ?? res ?? [];
            setDocs(Array.isArray(raw) ? raw : []);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Error al cargar documentos');
            setDocs([]);
        } finally { setLoading(false); }
    }, [get]);

    const fetchAudit = useCallback(async () => {
        setAuditLoading(true);
        try {
            const res = await get('/documents/audit');
            const raw = res?.data ?? res ?? [];
            setAuditDocs(Array.isArray(raw) ? raw : []);
        } catch { setAuditDocs([]); }
        finally { setAuditLoading(false); }
    }, [get]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);
    useEffect(() => { if (tab === 'audit' && auditDocs.length === 0) fetchAudit(); }, [tab]);

    const handleCloseUpload = () => { setShowUpload(false); fetchDocs(); };

    const handleDelete = async (id) => {
        try {
            await del(`/documents/${id}`);
            setDocs(prev => prev.filter(d => d.id !== id));
            if (auditDocs.length > 0) fetchAudit();
        } catch { /* silencioso */ }
    };

    // ── Filter & Group ────────────────────────────────────────────────────────
    const filtered = docs.filter(doc => {
        const matchSearch = !search
            || doc.document_name?.toLowerCase().includes(search.toLowerCase())
            || doc.owner_name?.toLowerCase().includes(search.toLowerCase());
        const matchOwner = filterOwner === 'all' || doc.owner_type === filterOwner;
        return matchSearch && matchOwner;
    });

    // Group by owner_type + owner_id
    const grouped = {};
    filtered.forEach(doc => {
        const key = `${doc.owner_type}::${doc.owner_id ?? 'company'}`;
        if (!grouped[key]) {
            grouped[key] = {
                ownerType: doc.owner_type,
                ownerName: doc.owner_name || (doc.owner_type === 'company' ? 'Empresa' : `#${doc.owner_id}`),
                ownerId: doc.owner_id,
                docs: [],
            };
        }
        grouped[key].docs.push(doc);
    });

    // Sort: workers first, then clients, then company
    const ORDER = { worker: 0, client: 1, company: 2 };
    const groups = Object.values(grouped).sort((a, b) => {
        const diff = (ORDER[a.ownerType] ?? 9) - (ORDER[b.ownerType] ?? 9);
        if (diff !== 0) return diff;
        return a.ownerName.localeCompare(b.ownerName);
    });

    // Stats
    const stats = {
        total:   docs.length,
        workers: docs.filter(d => d.owner_type === 'worker').length,
        clients: docs.filter(d => d.owner_type === 'client').length,
        company: docs.filter(d => d.owner_type === 'company').length,
    };

    const auditFiltered = auditDocs.filter(doc =>
        !search || doc.document_name?.toLowerCase().includes(search.toLowerCase())
              || doc.owner_name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="docs-page">
            {/* Header */}
            <div className="docs-header">
                <div>
                    <h1 className="docs-title">Documentos</h1>
                    <p className="docs-subtitle">Archivos organizados por perfil de trabajador, cliente y empresa</p>
                </div>
                <div className="docs-header-actions">
                    <button className="docs-btn-refresh" onClick={() => { fetchDocs(); if (tab === 'audit') fetchAudit(); }} title="Actualizar">
                        <RefreshCw size={15} />
                    </button>
                    <button className="docs-btn-upload" onClick={() => setShowUpload(true)}>
                        <Upload size={15} /> Subir Documento
                    </button>
                </div>
            </div>

            {error && <ErrorBanner message={error} onRetry={fetchDocs} />}

            {/* Stats */}
            <div className="docs-stats">
                <StatCard value={stats.total}   label="Total documentos" icon={FileText}   color={STAT_COLORS.total}   />
                <StatCard value={stats.workers}  label="Trabajadores"     icon={User}       color={STAT_COLORS.workers}  />
                <StatCard value={stats.clients}  label="Clientes"         icon={Building2}  color={STAT_COLORS.clients}  />
                <StatCard value={stats.company}  label="Empresa"          icon={Briefcase}  color={STAT_COLORS.company}  />
            </div>

            {/* Tabs */}
            <div className="docs-tabs">
                <button className={`docs-tab ${tab === 'active' ? 'docs-tab--active' : ''}`} onClick={() => setTab('active')}>
                    <Folder size={14} /> Carpetas
                    <span className="docs-tab-count">{docs.length}</span>
                </button>
                <button className={`docs-tab ${tab === 'audit' ? 'docs-tab--active' : ''}`} onClick={() => setTab('audit')}>
                    <Clock size={14} /> Auditoría
                    {auditDocs.length > 0 && (
                        <span className="docs-tab-count docs-tab-count--audit">
                            {auditDocs.filter(d => !d.is_active).length} eliminados
                        </span>
                    )}
                </button>
            </div>

            {/* Toolbar */}
            <div className="docs-toolbar-card">
                <div className="docs-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o persona..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                {tab === 'active' && (
                    <div className="docs-owner-tabs">
                        {['all', 'worker', 'client', 'company'].map(type => (
                            <button
                                key={type}
                                className={`docs-owner-tab ${filterOwner === type ? 'docs-owner-tab--active' : ''}`}
                                onClick={() => setFilterOwner(type)}
                            >
                                {type === 'all' ? 'Todos' : OWNER_TYPE_CONFIG[type]?.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Carpetas tab ── */}
            {tab === 'active' && (
                loading ? (
                    <div className="docs-loading"><Loader size={20} className="docs-spin" /><span>Cargando documentos...</span></div>
                ) : groups.length === 0 ? (
                    <EmptyState filtered={filtered.length === 0 && docs.length > 0} />
                ) : (
                    <div className="docs-folders">
                        {groups.map(g => (
                            <OwnerFolder
                                key={`${g.ownerType}::${g.ownerId ?? 'company'}`}
                                ownerType={g.ownerType}
                                ownerName={g.ownerName}
                                ownerId={g.ownerId}
                                docs={g.docs}
                                onDelete={handleDelete}
                                defaultOpen={groups.length === 1}
                            />
                        ))}
                    </div>
                )
            )}

            {/* ── Auditoría tab ── */}
            {tab === 'audit' && (
                <div className="docs-table-wrap">
                    {auditLoading ? (
                        <div className="docs-loading"><Loader size={20} className="docs-spin" /><span>Cargando auditoría...</span></div>
                    ) : auditFiltered.length === 0 ? (
                        <div className="docs-empty">
                            <Clock size={36} />
                            <div className="docs-empty__title">No hay registros de auditoría</div>
                            <div className="docs-empty__sub">Cuando se suban o eliminen documentos aparecerán aquí.</div>
                        </div>
                    ) : (
                        <table className="docs-table">
                            <thead>
                                <tr>
                                    <th>Archivo</th>
                                    <th>Tipo</th>
                                    <th>Pertenece a</th>
                                    <th>Subido</th>
                                    <th>Eliminado</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditFiltered.map(doc => <AuditRow key={doc.id} doc={doc} />)}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {showUpload && <UploadModal onClose={handleCloseUpload} />}
        </div>
    );
}
