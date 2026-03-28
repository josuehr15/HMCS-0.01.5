import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, FileImage, Download, Trash2, Loader, X } from 'lucide-react';
import './DocumentUploader.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const DOC_TYPE_LABELS = {
    id_photo: 'Foto de ID',
    ssn_photo: 'Foto de SSN',
    w9: 'Formulario W-9',
    contract: 'Contrato',
    insurance_cert: 'Certificado de Seguro',
    other: 'Otro',
};

function fileIcon(mimeType) {
    if (mimeType?.startsWith('image/')) return <FileImage size={14} />;
    return <FileText size={14} />;
}

function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * DocumentUploader — reusable for Workers, Clients, and Company docs.
 *
 * Props:
 *   ownerType  — 'worker' | 'client' | 'company'
 *   ownerId    — integer ID (or null for company-level)
 *   token      — JWT token for Authorization header
 */
export default function DocumentUploader({ ownerType, ownerId, token }) {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [docType, setDocType] = useState('other');
    const [error, setError] = useState('');
    const inputRef = useRef();

    const authHeaders = () => ({
        Authorization: `Bearer ${token || localStorage.getItem('hmcs_token') || ''}`,
    });

    // ── Load existing docs ─────────────────────────────────────────
    const loadDocs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ owner_type: ownerType });
            if (ownerId) params.set('owner_id', ownerId);
            const res = await fetch(`${API_BASE}/documents?${params}`, { headers: authHeaders() });
            const json = await res.json();
            setDocs(json.data || json || []);
        } catch { setDocs([]); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (ownerType && (ownerId || ownerType === 'company')) loadDocs();
    }, [ownerType, ownerId]);

    // ── Upload ─────────────────────────────────────────────────────
    const handleFile = async (file) => {
        if (!file) return;
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) { setError('El archivo excede 10 MB.'); return; }
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(file.type)) { setError('Tipo no permitido. Usa PDF, JPG o PNG.'); return; }

        setError('');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('owner_type', ownerType);
            if (ownerId) fd.append('owner_id', ownerId);
            fd.append('document_type', docType);
            fd.append('document_name', file.name);

            const res = await fetch(`${API_BASE}/documents/upload`, {
                method: 'POST',
                headers: authHeaders(),
                body: fd,
            });
            const json = await res.json();
            if (!res.ok) { setError(json.message || 'Error al subir archivo.'); return; }
            setDocs(prev => [json.data || json, ...prev]);
        } catch { setError('Error al subir archivo.'); }
        finally { setUploading(false); }
    };

    // ── Delete ─────────────────────────────────────────────────────
    const handleDelete = async (docId) => {
        if (!confirm('¿Eliminar este documento?')) return;
        try {
            await fetch(`${API_BASE}/documents/${docId}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            setDocs(prev => prev.filter(d => d.id !== docId));
        } catch { setError('Error al eliminar.'); }
    };

    // ── Download ───────────────────────────────────────────────────
    const handleDownload = (doc) => {
        const url = `${API_BASE}/documents/${doc.id}/download`;
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', doc.document_name);
        // Add token as query param for download
        a.href = `${url}?token=${token || localStorage.getItem('hmcs_token') || ''}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="doc-uploader">
            {/* Upload area */}
            <div
                className={`doc-drop-zone ${dragOver ? 'doc-drop-zone--over' : ''} ${uploading ? 'doc-drop-zone--uploading' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => !uploading && inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={e => handleFile(e.target.files[0])}
                />
                {uploading ? (
                    <><Loader size={18} className="doc-spin" /> <span>Subiendo...</span></>
                ) : (
                    <><Upload size={16} /> <span>Arrastra o haz clic para subir</span></>
                )}
            </div>

            {/* Doc type selector */}
            <div className="doc-type-row">
                <select
                    value={docType}
                    onChange={e => setDocType(e.target.value)}
                    className="doc-type-select"
                >
                    {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
                <span className="doc-hint">PDF, JPG, PNG — máx 10 MB</span>
            </div>

            {error && (
                <div className="doc-error">
                    <X size={13} />
                    <span>{error}</span>
                    <button onClick={() => setError('')}><X size={11} /></button>
                </div>
            )}

            {/* Document list */}
            {loading ? (
                <p className="doc-list-empty"><Loader size={14} className="doc-spin" /> Cargando documentos...</p>
            ) : docs.length === 0 ? (
                <p className="doc-list-empty">Sin documentos subidos</p>
            ) : (
                <ul className="doc-list">
                    {docs.map(doc => (
                        <li key={doc.id} className="doc-item">
                            <span className="doc-item__icon">{fileIcon(doc.mime_type)}</span>
                            <div className="doc-item__info">
                                <span className="doc-item__name" title={doc.document_name}>
                                    {doc.document_name}
                                </span>
                                <span className="doc-item__meta">
                                    {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                                    {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                                </span>
                            </div>
                            <div className="doc-item__actions">
                                <button
                                    className="doc-btn doc-btn--dl"
                                    onClick={() => handleDownload(doc)}
                                    title="Descargar"
                                >
                                    <Download size={13} />
                                </button>
                                <button
                                    className="doc-btn doc-btn--del"
                                    onClick={() => handleDelete(doc.id)}
                                    title="Eliminar"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
