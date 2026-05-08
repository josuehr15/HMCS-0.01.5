/**
 * generateContractDocs.js
 * W-9:      overlays worker data on the official IRS W-9 PDF template (page 1)
 * Contract: builds a clean multi-page PDF using pdf-lib (no LibreOffice dependency)
 */

const path = require('path');
const fs   = require('fs');
const { PDFDocument, StandardFonts, rgb, PageSizes } = require('pdf-lib');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'documents');
const W9_TEMPLATE = path.join(__dirname, 'w9_template.pdf');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function formatSSN(raw = '') {
    const d = raw.replace(/\D/g, '');
    if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
    return raw;
}

function fmtDate(d = new Date()) {
    const dt = d instanceof Date ? d : new Date(d);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${dt.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// W-9  — overlay text on the real IRS PDF (page 1 of w9_template.pdf)
// PDF coordinate system: (0,0) = bottom-left, Y increases upward.
// Values measured from pymupdf (top-left origin) converted: pdfY = pageH - muY
// pageH = 792
// ─────────────────────────────────────────────────────────────────────────────
async function generateW9PDF({ fullName, address, city, state, zip, ssn, signatureDataUrl, signDate }) {
    const templateBytes = fs.readFileSync(W9_TEMPLATE);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Use only page 1 of the IRS template
    const newDoc = await PDFDocument.create();
    const [page1] = await newDoc.copyPages(pdfDoc, [0]);
    newDoc.addPage(page1);
    const page = newDoc.getPages()[0];

    const fontNormal = await newDoc.embedFont(StandardFonts.Helvetica);
    const fontBold   = await newDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const H = 792;
    const py = (muY, sz = 11) => H - muY - (sz * 0.85);

    // ── Line 1: Name ──────────────────────────────────────────────────
    page.drawText(fullName, { x: 64, y: py(120, 11), size: 11, font: fontNormal, color: black });

    // ── Line 3a: Checkbox "Individual/sole proprietor" ────────────────
    page.drawText('X', { x: 76, y: py(179, 9), size: 9, font: fontBold, color: black });

    // ── Line 5: Address ───────────────────────────────────────────────
    // Field box: horizontal line at muY=300. Input area: muY=285-300.
    page.drawText(address, { x: 64, y: py(292, 11), size: 11, font: fontNormal, color: black });

    // ── Line 6: City, state, ZIP ──────────────────────────────────────
    // Field box: horizontal line at muY=324. Input area: muY=300-324.
    page.drawText(`${city}, ${state}  ${zip}`, { x: 64, y: py(315, 11), size: 11, font: fontNormal, color: black });

    // ── Part I: SSN — each digit centered in its individual cell ──────
    // Digit cells: muY=372-396. Cell x0 positions (px): 417.6, 432, 446.4 | 475.2, 489.6 | 518.4, 532.8, 547.2, 561.6
    // Each cell = 14.4px wide; digit center offset = ~4px from left edge
    const ssnDigits  = ssn.replace(/\D/g, '').slice(0, 9);
    const ssnCellX   = [421.8, 436.2, 450.6, 479.4, 493.8, 522.6, 537.0, 551.4, 565.8];
    const ssnPdfY    = H - 386 - (10 * 0.85);
    ssnDigits.split('').forEach((d, i) => {
        if (ssnCellX[i] !== undefined) {
            page.drawText(d, { x: ssnCellX[i], y: ssnPdfY, size: 10, font: fontBold, color: black });
        }
    });

    // ── Signature ─────────────────────────────────────────────────────
    if (signatureDataUrl && signatureDataUrl.startsWith('data:image/png;base64,')) {
        const b64      = signatureDataUrl.replace('data:image/png;base64,', '');
        const sigBytes = Buffer.from(b64, 'base64');
        const sigImg   = await newDoc.embedPng(sigBytes);
        page.drawImage(sigImg, {
            x: 120,
            y: py(600, 0) - 4,
            width:  200,
            height: 35,
        });
    }

    // ── Date ──────────────────────────────────────────────────────────
    page.drawText(fmtDate(signDate), { x: 415, y: py(592, 11), size: 11, font: fontNormal, color: black });

    const pdfBytes = await newDoc.save();
    const fileName = `w9_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(UPLOADS_DIR, fileName), pdfBytes);
    return { fileName, size: pdfBytes.length, mimeType: 'application/pdf' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF text layout engine — word-wrap + multi-page support
// ─────────────────────────────────────────────────────────────────────────────
function measureText(text, font, size) {
    return font.widthOfTextAtSize(text, size);
}

/**
 * Wrap a string into lines that fit within maxWidth.
 * Returns array of strings.
 */
function wrapText(text, font, size, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (measureText(test, font, size) <= maxWidth) {
            current = test;
        } else {
            if (current) lines.push(current);
            // If a single word is wider than maxWidth, force it
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines;
}

/**
 * Draw text block on PDF, handling word-wrap and page breaks.
 * Returns updated { page, y } state.
 */
function drawBlock(pdfDoc, pages, { page, y }, {
    text, font, size, color, x, maxWidth, lineHeight, spaceAfter = 0, indent = 0,
}) {
    const lines = wrapText(text, font, size, maxWidth - indent);
    const margin = { top: 72, bottom: 72 };

    for (const line of lines) {
        if (y - lineHeight < margin.bottom) {
            // New page
            const newPage = pdfDoc.addPage(PageSizes.Letter);
            pages.push(newPage);
            page = newPage;
            y = newPage.getHeight() - margin.top;
        }
        page.drawText(line, { x: x + indent, y, size, font, color });
        y -= lineHeight;
    }
    y -= spaceAfter;
    return { page, y };
}

/**
 * Draw a mixed-style paragraph: array of { text, bold } segments.
 * Handles inline bold/normal mixing with word-wrap.
 */
function drawMixedBlock(pdfDoc, pages, state, {
    segments, size, fontNormal, fontBold, color, x, maxWidth, lineHeight, spaceAfter = 0,
}) {
    const margin = { top: 72, bottom: 72 };
    let { page, y } = state;

    // Build word list with font info: [{word, font}]
    const tokens = [];
    for (const seg of segments) {
        const font = seg.bold ? fontBold : fontNormal;
        const words = seg.text.split(' ');
        for (let i = 0; i < words.length; i++) {
            // Preserve trailing space between segments
            const isLast = i === words.length - 1;
            tokens.push({ word: words[i], font, trailingSpace: !isLast });
        }
        // Add space between segments
        if (tokens.length > 0) tokens[tokens.length - 1].trailingSpace = true;
    }

    // Build lines respecting maxWidth
    const lines = [];
    let curLine  = [];
    let curWidth = 0;

    for (const tok of tokens) {
        if (!tok.word) continue;
        const space   = curLine.length > 0 ? measureText(' ', tok.font, size) : 0;
        const wWidth  = measureText(tok.word, tok.font, size);
        if (curLine.length > 0 && curWidth + space + wWidth > maxWidth) {
            lines.push(curLine);
            curLine  = [tok];
            curWidth = wWidth;
        } else {
            curWidth += space + wWidth;
            curLine.push(tok);
        }
    }
    if (curLine.length > 0) lines.push(curLine);

    for (const line of lines) {
        if (y - lineHeight < margin.bottom) {
            const newPage = pdfDoc.addPage(PageSizes.Letter);
            pages.push(newPage);
            page = newPage;
            y    = newPage.getHeight() - margin.top;
        }
        // Draw each token in the line
        let curX = x;
        for (let i = 0; i < line.length; i++) {
            const tok = line[i];
            page.drawText(tok.word, { x: curX, y, size, font: tok.font, color });
            curX += measureText(tok.word, tok.font, size);
            if (i < line.length - 1) {
                curX += measureText(' ', tok.font, size);
            }
        }
        y -= lineHeight;
    }
    y -= spaceAfter;
    return { page, y };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract — native PDF via pdf-lib (no LibreOffice)
// ─────────────────────────────────────────────────────────────────────────────
async function generateContractPDF({ fullName, address, city, state, zip, signatureDataUrl, signDate }) {
    const today       = fmtDate(signDate || new Date());
    const fullAddress = `${address}, ${city}, ${state} ${zip}`;

    const pdfDoc = await PDFDocument.create();
    const pages  = [];

    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black      = rgb(0, 0, 0);
    const gray       = rgb(0.4, 0.4, 0.4);
    const blue       = rgb(0.1, 0.35, 0.6);

    // Page layout constants
    const PAGE_W    = 612;   // Letter width
    const PAGE_H    = 792;   // Letter height
    const MARGIN_L  = 72;    // 1 inch
    const MARGIN_R  = 72;
    const MARGIN_T  = 72;
    const MARGIN_B  = 72;
    const TEXT_W    = PAGE_W - MARGIN_L - MARGIN_R;  // 468px usable

    // Add first page
    const firstPage = pdfDoc.addPage(PageSizes.Letter);
    pages.push(firstPage);
    let y = PAGE_H - MARGIN_T;

    // ── Header bar ────────────────────────────────────────────────────────────
    firstPage.drawRectangle({
        x: MARGIN_L, y: y - 8, width: TEXT_W, height: 2,
        color: blue,
    });
    y -= 24;

    // ── Title ─────────────────────────────────────────────────────────────────
    const titleText = 'INDEPENDENT CONTRACTOR AGREEMENT';
    const titleW    = measureText(titleText, fontBold, 16);
    firstPage.drawText(titleText, {
        x: MARGIN_L + (TEXT_W - titleW) / 2,
        y,
        size: 16, font: fontBold, color: blue,
    });
    y -= 28;

    // Thin rule under title
    firstPage.drawRectangle({ x: MARGIN_L, y, width: TEXT_W, height: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 18;

    // ── Intro paragraph ───────────────────────────────────────────────────────
    let state_ = { page: firstPage, y };
    state_ = drawMixedBlock(pdfDoc, pages, state_, {
        segments: [
            { text: 'This Independent Contractor Agreement ("Agreement") is made effective as of ', bold: false },
            { text: today, bold: true },
            { text: ', by and between ', bold: false },
            { text: 'HM Plumbing & Electric Staffing LLC', bold: true },
            { text: ' ("Recipient"), of 500 Lucas Dr, Savannah, GA 31406, and ', bold: false },
            { text: fullName, bold: true },
            { text: ' ("Contractor"), of ' + fullAddress + '.', bold: false },
        ],
        size: 10, fontNormal, fontBold, color: black,
        x: MARGIN_L, maxWidth: TEXT_W, lineHeight: 15, spaceAfter: 14,
    });

    // ── Section data ──────────────────────────────────────────────────────────
    const sections = [
        { n: '1',  t: 'Description of Services.',      b: 'Beginning on the effective date above, the Contractor will provide working hours as a Plumber and/or Electrician. The Contractor has the right of control over how the Contractor will perform the Services. The Recipient does not have this right of control over how the Contractor will perform the Services.' },
        { n: '2',  t: 'Payment for Services.',          b: 'The Recipient will pay compensation to the Contractor for the Services based on working hours performed in the week. No other fees and/or expenses will be paid to the Contractor unless approved in advance in writing. The Contractor shall be solely responsible for any and all taxes, Social Security contributions, disability insurance, unemployment taxes, and other payroll-type taxes.' },
        { n: '3',  t: 'Term/Termination.',              b: 'This Agreement terminates when the Contractor\'s collaboration is no longer necessary. Furthermore, the Contractor has the ability to terminate this Agreement "at will." A regular, ongoing relationship of indefinite term is not contemplated.' },
        { n: '4',  t: 'Relationship of Parties.',       b: 'The Contractor is an independent contractor with respect to the Recipient and not an employee. The Recipient will not provide fringe benefits, including health insurance benefits, paid vacation, or any other employee benefit. The relationship between the Contractor and the Recipient shall be non-exclusive.' },
        { n: '5',  t: "Recipient's Control.",           b: "The Recipient has no right or power to control or otherwise interfere with the Contractor's mode of effecting performance under this Agreement. The Recipient's only concern is the result of the Contractor's work." },
        { n: '6',  t: 'Professional Capacity.',         b: 'The Contractor is a professional who uses their own professional and business methods to perform Services. The Contractor has not and will not receive training from the Recipient regarding how to perform the Services.' },
        { n: '7',  t: 'Personal Services Not Required.', b: "The Contractor is not required to render Services personally and may employ others to perform the Services without the Recipient's knowledge or consent." },
        { n: '8',  t: 'No Location on the Premises.',   b: 'The Contractor has no desk or other equipment either located at or furnished by the Recipient.' },
        { n: '9',  t: 'No Set Work Hours.',              b: 'The Contractor has no set hours of work. There is no requirement that the Contractor work full time or otherwise account for work hours.' },
        { n: '10', t: 'Expenses Paid by Contractor.',   b: "The Contractor's business and travel expenses are to be paid by the Contractor and not by the Recipient." },
        { n: '11', t: 'Confidentiality.',                b: 'The Contractor will not at any time or in any manner, either directly or indirectly, use for personal benefit, or divulge, disclose, or communicate any Confidential Information of the Recipient. This provision shall continue to be effective after the termination of this Agreement.' },
        { n: '12', t: 'Injuries.',                       b: "The Contractor acknowledges the obligation to obtain appropriate insurance coverage. The Contractor waives any rights to recovery from the Recipient for any injuries that the Contractor may sustain while performing the Services and that are a result of the negligence of the Contractor." },
        { n: '13', t: 'Indemnification.',                b: 'The Contractor agrees to indemnify and hold harmless the Recipient from all claims, losses, expenses, fees including attorney fees, costs, and judgments that may be asserted against the Recipient that result from the acts or omissions of the Contractor.' },
        { n: '14', t: 'No Right to Act as Agent.',       b: 'An employer-employee or principal-agent relationship is not created by this Agreement. The Contractor has no right to act as an agent for the Recipient.' },
        { n: '15', t: 'Entire Agreement.',               b: 'This Agreement constitutes the entire agreement between the parties. No modification of this Agreement shall be deemed effective unless in writing and signed by the parties.' },
        { n: '16', t: 'Waiver of Breach.',               b: 'The waiver by the Recipient of a breach of any provision of this Agreement by the Contractor shall not operate or be construed as a waiver of any subsequent breach.' },
        { n: '17', t: 'Severability.',                   b: 'If any provision of this Agreement shall be held invalid or unenforceable, the remaining provisions shall continue to be valid and enforceable.' },
        { n: '18', t: 'Applicable Law.',                 b: 'This Agreement shall be governed by the laws of the State of Georgia.' },
        { n: '19', t: 'Signatories.',                    b: `This Agreement shall be signed by Josue Hernandez on behalf of HM Plumbing & Electric Staffing LLC and by ${fullName}. This Agreement is effective as of the date first above written.` },
    ];

    for (const s of sections) {
        state_ = drawMixedBlock(pdfDoc, pages, state_, {
            segments: [
                { text: `${s.n}. ${s.t} `, bold: true },
                { text: s.b, bold: false },
            ],
            size: 10, fontNormal, fontBold, color: black,
            x: MARGIN_L, maxWidth: TEXT_W, lineHeight: 15, spaceAfter: 8,
        });
    }

    // ── Signature block ───────────────────────────────────────────────────────
    // Ensure enough space for signature block (~120px needed)
    if (state_.y < MARGIN_B + 130) {
        const newPage = pdfDoc.addPage(PageSizes.Letter);
        pages.push(newPage);
        state_.page = newPage;
        state_.y    = PAGE_H - MARGIN_T;
    }

    let { page: sigPage, y: sigY } = state_;
    sigY -= 16;

    // Thin rule above signatures
    sigPage.drawRectangle({ x: MARGIN_L, y: sigY, width: TEXT_W, height: 0.5, color: rgb(0.8, 0.8, 0.8) });
    sigY -= 20;

    // Two-column signature block
    const colW  = TEXT_W / 2 - 10;
    const col1X = MARGIN_L;
    const col2X = MARGIN_L + TEXT_W / 2 + 10;

    // Draw column headers
    const drawSigCol = (x, role, entity, signer, date) => {
        sigPage.drawText(role, { x, y: sigY, size: 9, font: fontBold, color: gray });
        sigPage.drawText(entity, { x, y: sigY - 14, size: 9, font: fontNormal, color: black });
        sigPage.drawText(`By: ${signer}`, { x, y: sigY - 28, size: 9, font: fontNormal, color: black });
        // Signature line
        sigPage.drawLine({
            start: { x, y: sigY - 56 },
            end:   { x: x + colW, y: sigY - 56 },
            thickness: 0.5, color: rgb(0.5, 0.5, 0.5),
        });
        sigPage.drawText('Signature', { x, y: sigY - 68, size: 7.5, font: fontNormal, color: gray });
        sigPage.drawText(`Date: ${date}`, { x, y: sigY - 80, size: 9, font: fontNormal, color: black });
    };

    drawSigCol(col1X, 'The Recipient:', 'HM Plumbing & Electric Staffing LLC', 'Josue Hernandez', today);
    drawSigCol(col2X, 'The Contractor:', fullName, fullName, today);

    // ── Contractor digital signature image ────────────────────────────────────
    if (signatureDataUrl && signatureDataUrl.startsWith('data:image/png;base64,')) {
        try {
            const b64      = signatureDataUrl.replace('data:image/png;base64,', '');
            const sigBytes = Buffer.from(b64, 'base64');
            const sigImg   = await pdfDoc.embedPng(sigBytes);
            sigPage.drawImage(sigImg, {
                x:      col2X,
                y:      sigY - 54,
                width:  140,
                height: 30,
            });
        } catch (_) { /* ignore if image fails */ }
    }

    sigY -= 100;

    // ── Footer note ───────────────────────────────────────────────────────────
    sigPage.drawText('Digital signature applied electronically — HM Plumbing & Electric Staffing LLC', {
        x: MARGIN_L, y: sigY, size: 7.5, font: fontNormal, color: gray,
    });

    // Add page numbers to all pages
    const totalPages = pdfDoc.getPageCount();
    pdfDoc.getPages().forEach((pg, i) => {
        const numText = `Page ${i + 1} of ${totalPages}`;
        const nw      = measureText(numText, fontNormal, 8);
        pg.drawText(numText, {
            x: (PAGE_W - nw) / 2,
            y: MARGIN_B / 2,
            size: 8, font: fontNormal, color: gray,
        });
    });

    const pdfBytes = await pdfDoc.save();
    const fileName = `contract_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(UPLOADS_DIR, fileName), pdfBytes);
    return { fileName, size: pdfBytes.length, mimeType: 'application/pdf' };
}

module.exports = { generateW9PDF, generateContractPDF };
