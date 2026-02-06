// Receipt Organizer - Main Application Logic

let uploadedImages = [];

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const previewGrid = document.getElementById('previewGrid');
const imageCount = document.getElementById('imageCount');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize Event Listeners
function init() {
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    
    // Button events
    generateBtn.addEventListener('click', generatePDF);
    clearBtn.addEventListener('click', clearAll);
}

// File Selection Handler
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
}

// Drag Over Handler
function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
}

// Drag Leave Handler
function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
}

// Drop Handler
function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
    );
    processFiles(files);
}

// Process Files
function processFiles(files) {
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const receiptNo = extractReceiptNumber(file.name);
                uploadedImages.push({
                    file: file,
                    dataUrl: e.target.result,
                    name: file.name,
                    receiptNo: receiptNo,
                    width: img.width,
                    height: img.height,
                    isLandscape: img.width > img.height
                });
                
                // Sort images by receipt number
                uploadedImages.sort((a, b) => {
                    const numA = parseInt(a.receiptNo) || 999999;
                    const numB = parseInt(b.receiptNo) || 999999;
                    return numA - numB;
                });
                
                updatePreview();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Extract Receipt Number from Filename
function extractReceiptNumber(filename) {
    // Try to match "Receipt No 123" or "receipt_no_123" or just numbers
    const match = filename.match(/receipt[\s_-]*no[\s_-]*(\d+)/i);
    if (match) {
        return match[1];
    }
    
    // Try to extract any number from filename
    const numberMatch = filename.match(/(\d+)/);
    if (numberMatch) {
        return numberMatch[1];
    }
    
    return uploadedImages.length + 1;
}

// Update Preview
function updatePreview() {
    if (uploadedImages.length === 0) {
        previewSection.style.display = 'none';
        return;
    }
    
    previewSection.style.display = 'block';
    imageCount.textContent = uploadedImages.length;
    
    previewGrid.innerHTML = '';
    uploadedImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <img src="${img.dataUrl}" alt="${img.name}" class="preview-image">
            <div class="preview-info">
                <span class="preview-name" title="${img.name}">${img.name}</span>
                <span class="preview-badge">No. ${img.receiptNo}</span>
            </div>
        `;
        previewGrid.appendChild(item);
    });
}

// Clear All
function clearAll() {
    uploadedImages = [];
    updatePreview();
    fileInput.value = '';
}

// Generate PDF
async function generatePDF() {
    if (uploadedImages.length === 0) {
        alert('Please upload some images first!');
        return;
    }
    
    loadingOverlay.style.display = 'flex';
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });
        
        const pageWidth = 595.28; // A4 width in points
        const pageHeight = 841.89; // A4 height in points
        const margin = 30;
        const spacing = 20;
        const gridRows = 2;
        const gridCols = 2;
        
        const cellWidth = (pageWidth - 2 * margin - (gridCols - 1) * spacing) / gridCols;
        const cellHeight = (pageHeight - 2 * margin - (gridRows - 1) * spacing) / gridRows;
        
        let currentPage = 0;
        let i = 0;
        
        while (i < uploadedImages.length) {
            if (currentPage > 0) {
                pdf.addPage();
            }
            currentPage++;
            
            // Track occupied slots in 2x2 grid
            const slots = [[false, false], [false, false]];
            const imgsOnPage = [];
            
            // Fill page with images
            let j = i;
            while (j < uploadedImages.length && imgsOnPage.length < 4) {
                const img = uploadedImages[j];
                
                if (img.isLandscape) {
                    // Try to fit landscape in top row (span 2 columns)
                    if (!slots[0][0] && !slots[0][1]) {
                        imgsOnPage.push({ img, row: 0, col: 0, colspan: 2, rowspan: 1 });
                        slots[0][0] = slots[0][1] = true;
                    }
                    // Try to fit in bottom row
                    else if (!slots[1][0] && !slots[1][1]) {
                        imgsOnPage.push({ img, row: 1, col: 0, colspan: 2, rowspan: 1 });
                        slots[1][0] = slots[1][1] = true;
                    } else {
                        break; // No space for landscape
                    }
                } else {
                    // Try to fit portrait in any single slot
                    let placed = false;
                    for (let row = 0; row < 2; row++) {
                        for (let col = 0; col < 2; col++) {
                            if (!slots[row][col]) {
                                imgsOnPage.push({ img, row, col, colspan: 1, rowspan: 1 });
                                slots[row][col] = true;
                                placed = true;
                                break;
                            }
                        }
                        if (placed) break;
                    }
                    if (!placed) break; // No space for portrait
                }
                j++;
            }
            
            // Draw images on page
            for (const { img, row, col, colspan, rowspan } of imgsOnPage) {
                const cellW = cellWidth * colspan + spacing * (colspan - 1);
                const cellH = cellHeight * rowspan + spacing * (rowspan - 1);
                const captionSpace = 40;
                const availableH = cellH - captionSpace;
                
                // Calculate image dimensions to fit in cell
                const scale = Math.min(cellW / img.width, availableH / img.height);
                const imgW = img.width * scale;
                const imgH = img.height * scale;
                
                // Calculate position
                const x = margin + col * (cellWidth + spacing) + (cellW - imgW) / 2;
                const y = margin + row * (cellHeight + spacing) + (availableH - imgH) / 2;
                
                // Add image
                pdf.addImage(img.dataUrl, 'JPEG', x, y, imgW, imgH);
                
                // Add caption
                const caption = `Receipt No: ${img.receiptNo}`;
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                const captionWidth = pdf.getTextWidth(caption);
                const captionX = margin + col * (cellWidth + spacing) + (cellW - captionWidth) / 2;
                const captionY = y + imgH + 25;
                pdf.text(caption, captionX, captionY);
            }
            
            i = j;
        }
        
        // Generate filename with today's date
        const today = new Date().toISOString().split('T')[0];
        const filename = `receipts_${today}.pdf`;
        
        // Save PDF
        pdf.save(filename);
        
        loadingOverlay.style.display = 'none';
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please try again.');
        loadingOverlay.style.display = 'none';
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
