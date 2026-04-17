// Receipt Organizer - Main Application Logic

const MAX_IMAGES = 50;
const COMPRESS_MAX_DIM = 2000;
const COMPRESS_QUALITY = 0.82;
const DRAG_DELAY_MS = 200;
const DRAG_CANCEL_PX = 10;

let uploadedImages = [];
let pendingFiles = 0;
let insertionCounter = 0;
let isAutoSort = true;

// Mouse drag state
let dragSrcIndex = null;

// Touch drag state
let touchDragSrcIndex = null;
let touchDragActivated = false;
let touchDragTimer = null;
let touchClone = null;
let touchOffsetX = 0;
let touchOffsetY = 0;
let touchStartX = 0;
let touchStartY = 0;

// DOM Elements
const uploadZone     = document.getElementById('uploadZone');
const fileInput      = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const previewGrid    = document.getElementById('previewGrid');
const imageCount     = document.getElementById('imageCount');
const generateBtn    = document.getElementById('generateBtn');
const clearBtn       = document.getElementById('clearBtn');
const addMoreBtn     = document.getElementById('addMoreBtn');
const sortToggleBtn  = document.getElementById('sortToggleBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText    = document.getElementById('loadingText');
const filenameInput  = document.getElementById('filenameInput');
const toast          = document.getElementById('toast');
const modalOverlay   = document.getElementById('modalOverlay');
const modalMessage   = document.getElementById('modalMessage');
const modalConfirm   = document.getElementById('modalConfirm');
const modalCancel    = document.getElementById('modalCancel');

// Initialize
function init() {
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    document.addEventListener('paste', handlePaste);

    generateBtn.addEventListener('click', generatePDF);
    clearBtn.addEventListener('click', clearAll);
    addMoreBtn.addEventListener('click', () => fileInput.click());
    sortToggleBtn.addEventListener('click', handleSortToggle);
}

// ── File Input ────────────────────────────────────────────────────────────────

function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    processFiles(files);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    processFiles(files);
}

// Paste images directly from clipboard (Ctrl+V / mobile share)
function handlePaste(e) {
    const files = Array.from(e.clipboardData.items)
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean);
    if (files.length > 0) processFiles(files);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

// Replaces native confirm()/alert() — returns a Promise<boolean>
function showModal(message, { confirmLabel = 'OK', cancelLabel = null } = {}) {
    return new Promise((resolve) => {
        modalMessage.textContent = message;
        modalConfirm.textContent = confirmLabel;

        if (cancelLabel) {
            modalCancel.textContent = cancelLabel;
            modalCancel.style.display = '';
        } else {
            modalCancel.style.display = 'none';
        }

        modalOverlay.style.display = 'flex';
        modalConfirm.focus();

        const cleanup = (result) => {
            modalOverlay.style.display = 'none';
            modalConfirm.removeEventListener('click', onConfirm);
            modalCancel.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };

        const onConfirm = () => cleanup(true);
        const onCancel  = () => cleanup(false);
        const onKey = (e) => {
            if (e.key === 'Escape') cleanup(false);
            if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
        };

        modalConfirm.addEventListener('click', onConfirm);
        modalCancel.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
    });
}

// ── Sort Mode ─────────────────────────────────────────────────────────────────

function handleSortToggle() {
    isAutoSort = !isAutoSort;
    updateSortToggleLabel();
    if (isAutoSort) {
        sortImages();
        updatePreview();
    }
}

function updateSortToggleLabel() {
    const span = sortToggleBtn.querySelector('span');
    if (isAutoSort) {
        span.textContent = 'Auto Sort';
        sortToggleBtn.dataset.mode = 'auto';
        sortToggleBtn.title = 'Auto-sorting by receipt number — click to switch to manual order';
    } else {
        span.textContent = 'Manual Order';
        sortToggleBtn.dataset.mode = 'manual';
        sortToggleBtn.title = 'Manual order active — click to auto-sort by receipt number';
    }
}

function activateManualOrder() {
    if (isAutoSort) {
        isAutoSort = false;
        updateSortToggleLabel();
    }
}

// Stable sort: numeric receipt number, ties broken by insertion order
function sortImages() {
    uploadedImages.sort((a, b) => {
        const numA = parseInt(a.receiptNo, 10) || 999999;
        const numB = parseInt(b.receiptNo, 10) || 999999;
        if (numA !== numB) return numA - numB;
        return a.insertionOrder - b.insertionOrder;
    });
}

// ── Image Helpers ─────────────────────────────────────────────────────────────

// Compress via canvas — resolves with {dataUrl, width, height}, rejects on decode failure
function compressImage(originalDataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
                const ratio = Math.min(COMPRESS_MAX_DIM / width, COMPRESS_MAX_DIM / height);
                width  = Math.round(width  * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve({ dataUrl: canvas.toDataURL('image/jpeg', COMPRESS_QUALITY), width, height });
        };
        img.onerror = () => reject(new Error('Image decode failed'));
        img.src = originalDataUrl;
    });
}

function sanitizeFilename(name) {
    return name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function isUnsupportedFormat(file) {
    return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

// ── Process Files ─────────────────────────────────────────────────────────────

async function processFiles(files) {
    if (files.length === 0) return;

    // Detect HEIC/HEIF before trying to decode — canvas can't handle them
    const heicFiles = files.filter(isUnsupportedFormat);
    if (heicFiles.length > 0) {
        showToast(
            `${heicFiles.length} HEIC/HEIF file(s) skipped — export as JPG from Photos first.`,
            'error'
        );
        files = files.filter(f => !isUnsupportedFormat(f));
        if (files.length === 0) return;
    }

    const remaining = MAX_IMAGES - uploadedImages.length - pendingFiles;
    if (remaining <= 0) {
        showToast(`Maximum ${MAX_IMAGES} images reached.`, 'error');
        return;
    }
    if (files.length > remaining) {
        showToast(`Only ${remaining} more image(s) can be added (max ${MAX_IMAGES}).`, 'error');
        files = files.slice(0, remaining);
    }

    const MAX_SIZE_MB = 5;
    const oversized = files.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
        const names = oversized.map(f => f.name).join('\n');
        const ok = await showModal(
            `The following file(s) are over ${MAX_SIZE_MB}MB:\n\n${names}\n\nContinue anyway?`,
            { confirmLabel: 'Continue', cancelLabel: 'Cancel' }
        );
        if (!ok) return;
    }

    const startIndex = uploadedImages.length;
    pendingFiles += files.length;
    updateUploadingIndicator();

    files.forEach((file, fileIndex) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const { dataUrl, width, height } = await compressImage(e.target.result);
                const receiptNo = extractReceiptNumber(file.name, startIndex + fileIndex + 1);
                uploadedImages.push({
                    dataUrl,
                    name: file.name,
                    receiptNo,
                    width,
                    height,
                    isLandscape: width > height,
                    format: 'JPEG',
                    insertionOrder: insertionCounter++,
                });
                if (isAutoSort) sortImages();
            } catch {
                showToast(`Could not process "${file.name}" — unsupported or corrupt image.`, 'error');
            } finally {
                pendingFiles--;
                updateUploadingIndicator();
                updatePreview();
            }
        };

        // If the file can't be read at all, clean up the pending counter
        reader.onerror = () => {
            pendingFiles--;
            updateUploadingIndicator();
            showToast(`Failed to read "${file.name}".`, 'error');
        };

        reader.readAsDataURL(file);
    });
}

function updateUploadingIndicator() {
    const titleEl = uploadZone.querySelector('.upload-title');
    titleEl.textContent = pendingFiles > 0
        ? `Processing ${pendingFiles} image(s)…`
        : 'Drop receipt images here';
}

// Only matches explicit "Receipt No X" patterns — generic filenames use the index fallback
function extractReceiptNumber(filename, fallback) {
    const match = filename.match(/receipt[\s_-]*no[\s_-]*(\d+)/i);
    if (match) return match[1];
    return String(fallback);
}

// ── Slot Packing ──────────────────────────────────────────────────────────────

// Single source of truth — used by both page count and PDF drawing
function packIntoPages(images) {
    const pages = [];
    let i = 0;
    while (i < images.length) {
        const slots = [[false, false], [false, false]];
        const page  = [];
        let j = i;
        while (j < images.length) {
            const img = images[j];
            let placed = false;
            if (img.isLandscape) {
                if (!slots[0][0] && !slots[0][1]) {
                    page.push({ img, row: 0, col: 0, colspan: 2, rowspan: 1 });
                    slots[0][0] = slots[0][1] = true;
                    placed = true;
                } else if (!slots[1][0] && !slots[1][1]) {
                    page.push({ img, row: 1, col: 0, colspan: 2, rowspan: 1 });
                    slots[1][0] = slots[1][1] = true;
                    placed = true;
                }
            } else {
                for (let r = 0; r < 2 && !placed; r++) {
                    for (let c = 0; c < 2 && !placed; c++) {
                        if (!slots[r][c]) {
                            page.push({ img, row: r, col: c, colspan: 1, rowspan: 1 });
                            slots[r][c] = true;
                            placed = true;
                        }
                    }
                }
            }
            if (!placed) break;
            j++;
        }
        pages.push(page);
        i = j;
    }
    return pages;
}

// ── Preview ───────────────────────────────────────────────────────────────────

function updatePreview() {
    if (uploadedImages.length === 0) {
        previewSection.style.display = 'none';
        return;
    }

    previewSection.style.display = 'block';
    imageCount.textContent = uploadedImages.length;

    const fragment = document.createDocumentFragment();
    uploadedImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className  = 'preview-item';
        item.draggable  = true;
        item.dataset.index = index;
        item.tabIndex   = 0;
        item.setAttribute('role', 'listitem');
        item.setAttribute('aria-label',
            `Receipt ${img.receiptNo}, ${img.name}. Press arrow keys to reorder.`);

        item.innerHTML = `
            <button class="delete-btn" data-index="${index}" title="Remove image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <img src="${escapeHtml(img.dataUrl)}" alt="" class="preview-image">
            <div class="preview-info">
                <span class="preview-name" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</span>
                <label class="receipt-label">
                    <div class="receipt-badge-row">
                        <svg class="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <input class="preview-badge receipt-input" type="text"
                               value="${escapeHtml(img.receiptNo)}" data-index="${index}">
                    </div>
                    <span class="edit-hint">tap to edit</span>
                </label>
            </div>
        `;
        fragment.appendChild(item);
    });

    previewGrid.innerHTML = '';
    previewGrid.appendChild(fragment);

    // Delete buttons — with undo via toast
    previewGrid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx      = parseInt(btn.dataset.index, 10);
            const snapshot = uploadedImages.map(img => ({ ...img }));
            uploadedImages.splice(idx, 1);
            updatePreview();
            showToast('Image removed.', 'success', () => {
                uploadedImages = snapshot;
                updatePreview();
            });
        });
    });

    // Receipt number inputs
    previewGrid.querySelectorAll('.receipt-input').forEach(input => {
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

        // Live validation: red border while field is empty
        input.addEventListener('input', (e) => {
            e.target.classList.toggle('receipt-input--error', e.target.value.trim() === '');
        });

        input.addEventListener('change', (e) => {
            const idx    = parseInt(e.target.dataset.index, 10);
            const newVal = e.target.value.trim();
            uploadedImages[idx].receiptNo = newVal || String(idx + 1);
            e.target.value = uploadedImages[idx].receiptNo;
            e.target.classList.remove('receipt-input--error');
            if (isAutoSort) {
                sortImages();
                updatePreview();
            }
        });
    });

    // Keyboard reorder — ↑/↓ arrow keys on focused cards
    previewGrid.querySelectorAll('.preview-item').forEach(item => {
        item.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            const idx    = parseInt(item.dataset.index, 10);
            const newIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= uploadedImages.length) return;
            activateManualOrder();
            const [moved] = uploadedImages.splice(idx, 1);
            uploadedImages.splice(newIdx, 0, moved);
            updatePreview();
            previewGrid.querySelector(`[data-index="${newIdx}"]`)?.focus();
        });
    });

    // Mouse drag-to-reorder
    previewGrid.querySelectorAll('.preview-item').forEach(item => {
        item.addEventListener('dragstart', handleCardDragStart);
        item.addEventListener('dragover',  handleCardDragOver);
        item.addEventListener('dragleave', handleCardDragLeave);
        item.addEventListener('drop',      handleCardDrop);
        item.addEventListener('dragend',   handleCardDragEnd);
        // Touch drag-to-reorder
        item.addEventListener('touchstart', handleTouchStart, { passive: true });
        item.addEventListener('touchmove',  handleTouchMove,  { passive: false });
        item.addEventListener('touchend',   handleTouchEnd);
    });
}

// ── Clear ─────────────────────────────────────────────────────────────────────

function clearAll() {
    const snapshot              = uploadedImages.map(img => ({ ...img }));
    const prevInsertionCounter  = insertionCounter;
    uploadedImages = [];
    insertionCounter = 0;
    isAutoSort = true;
    updateSortToggleLabel();
    updatePreview();
    fileInput.value = '';
    showToast('All images cleared.', 'success', () => {
        uploadedImages   = snapshot;
        insertionCounter = prevInsertionCounter;
        updatePreview();
    });
}

// ── Toast (with optional Undo action) ────────────────────────────────────────

let toastTimer;
function showToast(message, type = 'success', undoCallback = null) {
    toast.innerHTML = '';

    const msg = document.createElement('span');
    msg.textContent = message;
    toast.appendChild(msg);

    if (undoCallback) {
        const undoBtn = document.createElement('button');
        undoBtn.className   = 'toast-undo-btn';
        undoBtn.textContent = 'Undo';
        undoBtn.addEventListener('click', () => {
            clearTimeout(toastTimer);
            toast.classList.remove('toast-show');
            undoCallback();
        });
        toast.appendChild(undoBtn);
    }

    toast.className = `toast toast-${type} toast-show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('toast-show'), 4000);
}

// ── Mouse Drag-to-Reorder ─────────────────────────────────────────────────────

function handleCardDragStart(e) {
    dragSrcIndex = parseInt(this.dataset.index, 10);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    activateManualOrder();
}

function handleCardDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-target');
}

function handleCardDragLeave() {
    this.classList.remove('drag-target');
}

function handleCardDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const targetIndex = parseInt(this.dataset.index, 10);
    if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
        const [moved] = uploadedImages.splice(dragSrcIndex, 1);
        uploadedImages.splice(targetIndex, 0, moved);
        updatePreview();
    }
    this.classList.remove('drag-target');
}

function handleCardDragEnd() {
    this.classList.remove('dragging');
    for (const i of previewGrid.querySelectorAll('.preview-item')) {
        i.classList.remove('drag-target');
    }
    dragSrcIndex = null;
}

// ── Touch Drag-to-Reorder ─────────────────────────────────────────────────────
// 200ms hold activates drag; moving > DRAG_CANCEL_PX before that cancels it
// so normal scrolling is unaffected.

function handleTouchStart(e) {
    const touch   = e.touches[0];
    touchStartX   = touch.clientX;
    touchStartY   = touch.clientY;
    touchDragSrcIndex  = parseInt(this.dataset.index, 10);
    touchDragActivated = false;

    this.classList.add('touch-drag-pending');

    touchDragTimer = setTimeout(() => {
        touchDragActivated = true;
        this.classList.remove('touch-drag-pending');
        activateManualOrder();

        const rect   = this.getBoundingClientRect();
        touchOffsetX = touchStartX - rect.left;
        touchOffsetY = touchStartY - rect.top;

        touchClone = this.cloneNode(true);
        Object.assign(touchClone.style, {
            position:     'fixed',
            left:         `${rect.left}px`,
            top:          `${rect.top}px`,
            width:        `${rect.width}px`,
            opacity:      '0.85',
            pointerEvents:'none',
            zIndex:       '9999',
            transform:    'scale(1.05)',
            transition:   'none',
            boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
        });
        document.body.appendChild(touchClone);
        this.classList.add('dragging');
    }, DRAG_DELAY_MS);
}

function handleTouchMove(e) {
    const touch = e.touches[0];

    if (!touchDragActivated) {
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.hypot(dx, dy) > DRAG_CANCEL_PX) {
            clearTimeout(touchDragTimer);
            touchDragTimer    = null;
            touchDragSrcIndex = null;
            const pending = previewGrid.querySelector('.touch-drag-pending');
            if (pending) pending.classList.remove('touch-drag-pending');
        }
        return;
    }

    e.preventDefault();
    if (!touchClone) return;

    touchClone.style.left = `${touch.clientX - touchOffsetX}px`;
    touchClone.style.top  = `${touch.clientY - touchOffsetY}px`;

    touchClone.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.style.display = '';

    for (const i of previewGrid.querySelectorAll('.preview-item')) {
        i.classList.remove('drag-target');
    }
    const target = el?.closest('.preview-item');
    if (target && parseInt(target.dataset.index, 10) !== touchDragSrcIndex) {
        target.classList.add('drag-target');
    }
}

function handleTouchEnd(e) {
    clearTimeout(touchDragTimer);
    touchDragTimer = null;

    const pending = previewGrid.querySelector('.touch-drag-pending');
    if (pending) pending.classList.remove('touch-drag-pending');

    if (!touchDragActivated) {
        touchDragSrcIndex = null;
        return;
    }

    touchDragActivated = false;
    if (touchClone) { touchClone.remove(); touchClone = null; }

    const srcEl = previewGrid.querySelector(`[data-index="${touchDragSrcIndex}"]`);
    if (srcEl) srcEl.classList.remove('dragging');
    for (const i of previewGrid.querySelectorAll('.preview-item')) {
        i.classList.remove('drag-target');
    }

    const touch  = e.changedTouches[0];
    const el     = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = el?.closest('.preview-item');
    if (target) {
        const targetIndex = parseInt(target.dataset.index, 10);
        if (touchDragSrcIndex !== null && touchDragSrcIndex !== targetIndex) {
            const [moved] = uploadedImages.splice(touchDragSrcIndex, 1);
            uploadedImages.splice(targetIndex, 0, moved);
            updatePreview();
        }
    }
    touchDragSrcIndex = null;
}

// ── Generate PDF ──────────────────────────────────────────────────────────────

async function generatePDF() {
    if (uploadedImages.length === 0) {
        await showModal('Please upload some images first.', { confirmLabel: 'OK' });
        return;
    }

    const receiptNos = uploadedImages.map(img => img.receiptNo);
    const duplicates = [...new Set(receiptNos.filter((no, i) => receiptNos.indexOf(no) !== i))];
    if (duplicates.length > 0) {
        const ok = await showModal(
            `Duplicate receipt numbers detected: ${duplicates.join(', ')}\n\nContinue anyway?`,
            { confirmLabel: 'Continue', cancelLabel: 'Cancel' }
        );
        if (!ok) return;
    }

    loadingOverlay.style.display = 'flex';
    loadingText.textContent = 'Preparing…';

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

        const pageWidth  = 595.28;
        const pageHeight = 841.89;
        const margin     = 30;
        const spacing    = 20;
        const gridCols   = 2;
        const gridRows   = 2;
        const cellWidth  = (pageWidth  - 2 * margin - (gridCols - 1) * spacing) / gridCols;
        const cellHeight = (pageHeight - 2 * margin - (gridRows - 1) * spacing) / gridRows;

        const pages = packIntoPages(uploadedImages);

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            loadingText.textContent = `Generating page ${pageIndex + 1} of ${pages.length}…`;
            await new Promise(r => setTimeout(r, 0)); // yield so the browser repaints

            if (pageIndex > 0) pdf.addPage();
            const page = pages[pageIndex];

            for (const { img, row, col, colspan, rowspan } of page) {
                const cellW      = cellWidth  * colspan + spacing * (colspan - 1);
                const cellH      = cellHeight * rowspan + spacing * (rowspan - 1);
                const captionSpace = 40;
                const availableH = cellH - captionSpace;

                const scale = Math.min(cellW / img.width, availableH / img.height);
                const imgW  = img.width  * scale;
                const imgH  = img.height * scale;

                const x = margin + col * (cellWidth  + spacing) + (cellW - imgW) / 2;
                const y = margin + row * (cellHeight + spacing) + (availableH - imgH) / 2;

                pdf.addImage(img.dataUrl, img.format, x, y, imgW, imgH);

                const caption  = `Receipt No: ${img.receiptNo}`;
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0, 0, 0);
                const captionX = margin + col * (cellWidth + spacing) + (cellW - pdf.getTextWidth(caption)) / 2;
                pdf.text(caption, captionX, y + imgH + 25);
            }

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(150, 150, 150);
            const pageLabel = `Page ${pageIndex + 1} of ${pages.length}`;
            pdf.text(pageLabel, (pageWidth - pdf.getTextWidth(pageLabel)) / 2, pageHeight - 12);
        }

        loadingText.textContent = 'Saving…';
        await new Promise(r => setTimeout(r, 0));

        const rawName  = filenameInput.value.trim();
        const today    = new Date().toISOString().split('T')[0];
        const baseName = rawName ? sanitizeFilename(rawName) : `receipts_${today}`;
        const filename = `${baseName}.pdf`;

        pdf.save(filename);
        loadingOverlay.style.display = 'none';
        loadingText.textContent = 'Preparing…';
        showToast(`"${filename}" saved successfully!`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        loadingOverlay.style.display = 'none';
        loadingText.textContent = 'Preparing…';
        showToast('Error generating PDF. Please try again.', 'error');
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
