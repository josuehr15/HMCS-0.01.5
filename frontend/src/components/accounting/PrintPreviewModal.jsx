import ReactDOM from 'react-dom';

const PrintPreviewModal = ({ title, previewHtml, onPrint, onDownloadExcel, onDownloadPdf, onDownloadCsv, onClose }) => {
    return ReactDOM.createPortal(
        <div className="modal-overlay" style={{ zIndex: 500 }}>
            <div className="print-preview-modal" style={{ zIndex: 501 }}>

                <div className="print-preview-header">
                    <div className="print-preview-title">{title}</div>
                    <button className="print-preview-close" onClick={onClose}>×</button>
                </div>

                <div className="print-preview-body">
                    {/* previewHtml is generated internally — not user input */}
                    <div
                        className="print-preview-document"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                </div>

                <div className="print-preview-footer">
                    <button className="btn-outline" onClick={onClose}>Cancelar</button>
                    <div className="print-preview-actions">
                        {onDownloadCsv && (
                            <button className="tax-export-btn tax-export-btn--csv" onClick={onDownloadCsv}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                                    <line x1="4" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                    <line x1="4" y1="7.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                    <line x1="4" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                </svg>
                                Descargar CSV
                            </button>
                        )}
                        {onDownloadExcel && (
                            <button className="tax-export-btn tax-export-btn--excel" onClick={onDownloadExcel}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                                    <line x1="5.5" y1="1.5" x2="5.5" y2="12.5" stroke="currentColor" strokeWidth="1"/>
                                    <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" stroke="currentColor" strokeWidth="1"/>
                                </svg>
                                Descargar Excel
                            </button>
                        )}
                        <button className="tax-export-btn tax-export-btn--print" onClick={onPrint}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                                <path d="M4 5V2.5C4 2.2 4.2 2 4.5 2H9.5C9.8 2 10 2.2 10 2.5V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                <line x1="4" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                <line x1="4" y1="10.5" x2="8" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                            Imprimir / Guardar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PrintPreviewModal;
