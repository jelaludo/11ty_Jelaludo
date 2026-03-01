// ========================================
// IMAGE MERGER FUNCTIONALITY
// ========================================

// Global metadata cache for cross-tab integration

let mergeItems = []; // Array of {type: 'image'|'empty', data, text, metadata}
let mergeDirection = 'grid';
let mergeLayoutMode = 'auto-grid'; // auto-grid | manual-grid | horizontal | vertical | template
let selectedTemplateId = null;
let imageFit = 'contain';
let gridColumns = 2;
let includeEmptyCells = false;
let emptyCellPattern = 'after'; // 'before' | 'after'
let emptyCellColor = '#ffffff';
let frameSize = 6;
let frameColor = '#0d1117';
let selectedCellIndex = 0;
let isDraggingText = false;
let dragCellIndex = -1;
let isDraggingImage = false;
let dragImageIndex = -1;
let imageDragStartX = 0;
let imageDragStartY = 0;
let imageDragMoved = false;
let suppressNextClick = false;
let modalCellIndex = -1;
let isDraggingModal = false;
let modalOffsetX = 0;
let modalOffsetY = 0;
let outputScale = 1.0; // Output scale factor (1.0 = 100%)

// Generate metadata summary text for empty cells
function generateMetadataSummary(metadata) {
    if (!metadata) return '';
    
    let summary = [];
    
    // Flatten EXIF data for easier access
    let allExifData = {};
    if (metadata.exif) {
        allExifData = { ...metadata.exif };
        if (metadata.exif.ifd0) Object.assign(allExifData, metadata.exif.ifd0);
        if (metadata.exif.exif) Object.assign(allExifData, metadata.exif.exif);
        if (metadata.exif.gps) Object.assign(allExifData, metadata.exif.gps);
    }
    
    // PRIORITY 1: AI Image with Prompt
    if (metadata.aiMetadata?.hasComfyUI) {
        const ai = metadata.aiMetadata;
        
        // Use resolved prompt if available, otherwise use regular prompt
        let promptText = ai.resolvedPrompt || ai.prompt;
        
        if (promptText) {
            // Truncate very long prompts (keep first ~300 chars)
            if (promptText.length > 300) {
                promptText = promptText.substring(0, 297) + '...';
            }
            summary.push(promptText);
            
            // Add model info below prompt
            if (ai.model) {
                summary.push(`\n📐 ${ai.model}`);
            }
            
            return summary.join('\n');
        }
    }
    
    // PRIORITY 2: Camera/Lens Info (ONLY camera/lens, no file details)
    if (allExifData.Make || allExifData.Model || allExifData.LensModel) {
        // Camera info
        if (allExifData.Make || allExifData.Model) {
            const camera = [allExifData.Make, allExifData.Model].filter(x => x).join(' ').trim();
            if (camera) summary.push(`📷 ${camera}`);
        }
        
        // Lens info
        if (allExifData.LensModel) {
            summary.push(`🔍 ${allExifData.LensModel}`);
        }
        
        // Shooting settings on one line
        let settings = [];
        if (allExifData.FNumber) {
            settings.push(`f/${allExifData.FNumber}`);
        }
        if (allExifData.ExposureTime) {
            const shutter = allExifData.ExposureTime < 1 ? 
                `1/${Math.round(1/allExifData.ExposureTime)}s` : 
                `${allExifData.ExposureTime}s`;
            settings.push(shutter);
        }
        if (allExifData.ISO) {
            settings.push(`ISO ${allExifData.ISO}`);
        }
        
        if (settings.length > 0) {
            summary.push(settings.join(' · '));
        }
        
        return summary.join('\n');
    }
    
    // PRIORITY 3: GPS Info
    if (allExifData.GPSLatitude || allExifData.GPSLongitude || allExifData.latitude || allExifData.longitude) {
        summary.push('📍 Location Info:');
        
        const lat = allExifData.latitude || allExifData.GPSLatitude;
        const lon = allExifData.longitude || allExifData.GPSLongitude;
        
        if (lat && lon) {
            summary.push(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        }
        
        if (allExifData.GPSAltitude) {
            summary.push(`Altitude: ${allExifData.GPSAltitude}m`);
        }
        
        return summary.join('\n');
    }
    
    // FALLBACK: Basic file info
    if (metadata.fileName) {
        summary.push(metadata.fileName);
    }
    
    // Dimensions
    if (metadata.exif?.ImageWidth && metadata.exif?.ImageHeight) {
        summary.push(`${metadata.exif.ImageWidth} × ${metadata.exif.ImageHeight}`);
    }
    
    // Container type and size
    if (metadata.containerType && metadata.fileSize) {
        const sizeMB = (metadata.fileSize / (1024 * 1024)).toFixed(2);
        summary.push(`${metadata.containerType.toUpperCase()} · ${sizeMB} MB`);
    }
    
    return summary.join('\n');
}

// Initialize default button states
function initializeMergerDefaults() {
    
    // Ensure default values are set
    mergeDirection = 'grid';
    mergeLayoutMode = 'auto-grid';
    selectedTemplateId = null;
    imageFit = 'contain';
    gridColumns = 2;
    
    // Set default active states for buttons
    document.querySelectorAll('[id^="merge-"], [id^="template-"], .template-card').forEach(btn => btn.classList.remove('active'));
    document.getElementById('merge-auto-grid')?.classList.add('active');
    
    document.querySelectorAll('[id^="fit-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById('fit-contain')?.classList.add('active');
    
    // Set default description
    document.getElementById('fit-description').textContent = 'Scales to fit within cell, maintains aspect ratio';
    
    // Show grid columns only for manual grid
    document.getElementById('grid-columns-container').style.display = 'none';
    document.getElementById('grid-columns-value').textContent = '2';
    const gridSlider = document.getElementById('grid-columns');
    if (gridSlider) {
        gridSlider.value = '2';
    }

    // Initialize frame controls
    const frameSlider = document.getElementById('frame-size');
    if (frameSlider) {
        frameSlider.value = String(frameSize);
    }
    const frameValue = document.getElementById('frame-size-value');
    if (frameValue) {
        frameValue.textContent = String(frameSize);
    }
    const frameColorInput = document.getElementById('frame-color');
    const frameColorText = document.getElementById('frame-color-text');
    if (frameColorInput) frameColorInput.value = frameColor;
    if (frameColorText) frameColorText.value = frameColor;
}

// Setup merge upload zone (preview container)
const mergePreviewContainer = document.getElementById('merge-preview-container');
const mergePreview = document.getElementById('merge-preview');
const mergeFileInput = document.getElementById('mergeFileInput');

if (mergePreviewContainer && mergeFileInput) {
    // Initialize defaults
    initializeMergerDefaults();
    
    const handleMergeClick = (e) => {
        if (suppressNextClick) {
            suppressNextClick = false;
            return;
        }
        if (!e.target.closest('.draggable-text') && !e.target.closest('.merge-image')) {
            mergeFileInput.click();
        }
    };
    
    const handleMergeDragOver = (e) => {
        e.preventDefault();
        mergePreviewContainer.classList.add('drag-over');
    };
    
    const handleMergeDragLeave = (e) => {
        if (e.target === mergePreviewContainer) {
            mergePreviewContainer.classList.remove('drag-over');
        }
    };
    
    const handleMergeDrop = (e) => {
        e.preventDefault();
        mergePreviewContainer.classList.remove('drag-over');
        handleMergeFiles(e.dataTransfer.files);
    };
    
    mergePreviewContainer.addEventListener('click', handleMergeClick);
    mergePreviewContainer.addEventListener('dragover', handleMergeDragOver);
    mergePreviewContainer.addEventListener('dragleave', handleMergeDragLeave);
    mergePreviewContainer.addEventListener('drop', handleMergeDrop);
    
    mergeFileInput.addEventListener('change', (e) => {
        handleMergeFiles(e.target.files);
    });
}

async function handleMergeFiles(files) {
    if (!files || files.length === 0) return;
    
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        
        // Extract metadata for this image
        let metadata = null;
        
        // Check if already in cache
        if (imageMetadataCache.has(file.name)) {
            metadata = imageMetadataCache.get(file.name).metadata;
        } else {
            // Extract fresh metadata
            try {
                metadata = await extractMetadata(file);
                
                // Cache it
                imageMetadataCache.set(file.name, {
                    metadata: metadata,
                    file: file,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error(`Failed to extract metadata for ${file.name}:`, error);
            }
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const isFirstImage = mergeItems.length === 0;
                
                mergeItems.push({
                    type: 'image',
                    file: file,
                    dataUrl: e.target.result,
                    img: img,
                    width: img.width,
                    height: img.height,
                    metadata: metadata, // Attach metadata
                    imageOffsetX: 50,
                    imageOffsetY: 50,
                    text: {
                        content: '',
                        font: 'Arial, sans-serif',
                        size: 48,
                        color: '#ffffff',
                        position: 'center',
                        opacity: 1.0
                    }
                });
                
                // Reinitialize defaults on first image to ensure they're active
                if (isFirstImage) {
                    initializeMergerDefaults();
                    setMergeLayout('auto-grid');
                    setImageFit('contain');
                }
                
                updateMergeUI();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Empty Cells Functions
function toggleEmptyCells(enabled) {
    includeEmptyCells = enabled;
    document.getElementById('empty-cells-options').style.display = enabled ? 'block' : 'none';
    rebuildMergeItems();
    updateMergePreview();
}

function setEmptyCellPattern(pattern) {
    emptyCellPattern = pattern;
    document.querySelectorAll('[id^="pattern-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById('pattern-' + pattern).classList.add('active');
    rebuildMergeItems();
    updateMergePreview();
}

function setEmptyCellColor(color) {
    emptyCellColor = color;
    document.getElementById('empty-cell-color').value = color;
    document.getElementById('empty-cell-color-text').value = color;
    // Update existing empty cells
    mergeItems.forEach(item => {
        if (item.type === 'empty') {
            item.color = color;
        }
    });
    updateMergePreview();
}

function rebuildMergeItems() {
    // Extract only image items
    const images = mergeItems.filter(item => item.type === 'image');
    mergeItems = [];
    
    if (!includeEmptyCells) {
        mergeItems = images;
    } else {
        // Apply pattern
        images.forEach((img, index) => {
            if (emptyCellPattern === 'before') {
                // Add empty cell before each image
                // Use metadata from the image that follows
                const metadataSummary = img.metadata ? generateMetadataSummary(img.metadata) : 'Text Here';
                
                mergeItems.push({
                    type: 'empty',
                    color: emptyCellColor,
                    text: {
                        content: metadataSummary,
                        font: 'Arial, sans-serif',
                        size: 14,
                        color: '#000000',
                        position: 'center',
                        opacity: 1.0
                    }
                });
            }
            mergeItems.push(img);
            if (emptyCellPattern === 'after') {
                // Add empty cell after each image
                // Use metadata from the image that precedes
                const metadataSummary = img.metadata ? generateMetadataSummary(img.metadata) : 'Text Here';
                
                mergeItems.push({
                    type: 'empty',
                    color: emptyCellColor,
                    text: {
                        content: metadataSummary,
                        font: 'Arial, sans-serif',
                        size: 14,
                        color: '#000000',
                        position: 'center',
                        opacity: 1.0
                    }
                });
            }
        });
    }
    
    updateMergeUI();
}

// Text Overlay Functions
function selectCell(index) {
    selectedCellIndex = parseInt(index);
    if (selectedCellIndex >= 0 && selectedCellIndex < mergeItems.length) {
        const item = mergeItems[selectedCellIndex];
        document.getElementById('cell-text').value = item.text.content || '';
        document.getElementById('text-font').value = item.text.font;
        document.getElementById('text-size').value = item.text.size;
        document.getElementById('text-size-value').textContent = item.text.size;
        document.getElementById('text-color').value = item.text.color;
        document.getElementById('text-color-text').value = item.text.color;
        document.getElementById('text-opacity').value = Math.round(item.text.opacity * 100);
        document.getElementById('text-opacity-value').textContent = Math.round(item.text.opacity * 100);
    }
}

function updateCellText(text) {
    if (selectedCellIndex >= 0 && selectedCellIndex < mergeItems.length) {
        mergeItems[selectedCellIndex].text.content = text;
        updateMergePreview();
    }
}

function updateCellTextStyle(property, value) {
    if (selectedCellIndex >= 0 && selectedCellIndex < mergeItems.length) {
        mergeItems[selectedCellIndex].text[property] = value;
        
        // Update active state for position buttons
        if (property === 'position') {
            const positionContainer = event.target.parentElement;
            positionContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            // Clear custom position when using presets
            delete mergeItems[selectedCellIndex].text.customX;
            delete mergeItems[selectedCellIndex].text.customY;
        }
        
        // Sync color text field
        if (property === 'color') {
            document.getElementById('text-color-text').value = value;
        }
        
        updateMergePreview();
    }
}

// Text Click/Drag Handler
let mouseDownTime = 0;
let mouseDownX = 0;
let mouseDownY = 0;

function handleTextMouseDown(event, cellIndex) {
    event.stopPropagation();
    mouseDownTime = Date.now();
    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    dragCellIndex = cellIndex;
    
    // Wait to see if this is a drag or a click
    setTimeout(() => {
        const timeDiff = Date.now() - mouseDownTime;
        const moveDiff = Math.abs(event.clientX - mouseDownX) + Math.abs(event.clientY - mouseDownY);
        
        if (timeDiff < 200 && moveDiff < 5 && !isDraggingText) {
            // It's a click - open modal
            openTextModal(cellIndex);
        }
    }, 250);
    
    startDragText(event, cellIndex);
}

// Image pan (drag to adjust visible area)
document.addEventListener('mousedown', (event) => {
    const imageEl = event.target.closest('.merge-image');
    if (!imageEl) return;
    if (imageFit !== 'cover') return;
    const cellIndex = parseInt(imageEl.getAttribute('data-cell-index'), 10);
    if (Number.isNaN(cellIndex)) return;
    isDraggingImage = true;
    dragImageIndex = cellIndex;
    imageDragStartX = event.clientX;
    imageDragStartY = event.clientY;
    imageDragMoved = false;
    suppressNextClick = true;
    imageEl.style.cursor = 'grabbing';
    event.preventDefault();
});

document.addEventListener('mousemove', (event) => {
    if (!isDraggingImage || dragImageIndex < 0) return;
    const imageEl = document.querySelector(`.merge-image[data-cell-index="${dragImageIndex}"]`);
    if (!imageEl) return;
    const container = imageEl.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const moveDelta = Math.abs(event.clientX - imageDragStartX) + Math.abs(event.clientY - imageDragStartY);
    if (moveDelta > 2) {
        imageDragMoved = true;
    }
    const relativeX = (event.clientX - rect.left) / rect.width;
    const relativeY = (event.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, relativeX));
    const clampedY = Math.max(0, Math.min(1, relativeY));
    const item = mergeItems[dragImageIndex];
    if (!item) return;
    item.imageOffsetX = Math.round((1 - clampedX) * 100);
    item.imageOffsetY = Math.round((1 - clampedY) * 100);
    updateMergePreview();

    // Highlight potential swap target
    document.querySelectorAll('.merge-cell.drop-target').forEach(cell => cell.classList.remove('drop-target'));
    const hoverElement = document.elementFromPoint(event.clientX, event.clientY);
    const hoverCell = hoverElement ? hoverElement.closest('.merge-cell') : null;
    if (hoverCell) {
        const hoverIndex = parseInt(hoverCell.getAttribute('data-merge-cell'), 10);
        if (!Number.isNaN(hoverIndex) && hoverIndex >= 0 && hoverIndex !== dragImageIndex) {
            hoverCell.classList.add('drop-target');
        }
    }
});

document.addEventListener('mouseup', (event) => {
    if (!isDraggingImage) return;
    document.querySelectorAll('.merge-cell.drop-target').forEach(cell => cell.classList.remove('drop-target'));
    const dropElement = document.elementFromPoint(event.clientX, event.clientY);
    const dropCell = dropElement ? dropElement.closest('.merge-cell') : null;
    const dropIndex = dropCell ? parseInt(dropCell.getAttribute('data-merge-cell'), 10) : -1;
    if (!Number.isNaN(dropIndex) && dropIndex >= 0 && dropIndex !== dragImageIndex) {
        const sourceItem = mergeItems[dragImageIndex];
        const targetItem = mergeItems[dropIndex];
        if (sourceItem && targetItem && sourceItem.type === 'image' && targetItem.type === 'image') {
            mergeItems[dragImageIndex] = targetItem;
            mergeItems[dropIndex] = sourceItem;
            updateMergePreview();
        }
    }
    const imageEl = document.querySelector(`.merge-image[data-cell-index="${dragImageIndex}"]`);
    if (imageEl) {
        imageEl.style.cursor = 'grab';
    }
    isDraggingImage = false;
    dragImageIndex = -1;
    imageDragMoved = false;
});

// Text Drag Functions
function startDragText(event, cellIndex) {
    event.stopPropagation();
    isDraggingText = false; // Start as false, becomes true on movement
    dragCellIndex = cellIndex;
    
    const textElement = event.target;
    const cellElement = textElement.parentElement;
    const cellRect = cellElement.getBoundingClientRect();
    
    function onMouseMove(e) {
        const moveDist = Math.abs(e.clientX - mouseDownX) + Math.abs(e.clientY - mouseDownY);
        
        // Start dragging if moved more than 5px
        if (moveDist > 5) {
            isDraggingText = true;
        }
        
        if (!isDraggingText) return;
        
        const x = e.clientX - cellRect.left;
        const y = e.clientY - cellRect.top;
        
        // Convert to percentage
        const percentX = Math.max(10, Math.min(90, (x / cellRect.width) * 100));
        const percentY = Math.max(10, Math.min(90, (y / cellRect.height) * 100));
        
        // Update text position
        mergeItems[dragCellIndex].text.customX = percentX;
        mergeItems[dragCellIndex].text.customY = percentY;
        mergeItems[dragCellIndex].text.position = 'custom';
        
        // Update preview
        textElement.style.left = percentX + '%';
        textElement.style.top = percentY + '%';
        textElement.style.transform = 'translate(-50%, -50%)';
    }
    
    function onMouseUp() {
        isDraggingText = false;
        dragCellIndex = -1;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Deactivate all position preset buttons
        const positionButtons = document.querySelectorAll('.tab-button');
        positionButtons.forEach(btn => {
            if (btn.textContent.includes('Top') || btn.textContent.includes('Center') || 
                btn.textContent.includes('Bottom') || btn.textContent.includes('Left') || 
                btn.textContent.includes('Right')) {
                btn.classList.remove('active');
            }
        });
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function updateMergeUI() {
    // Update selected images list
    const listContainer = document.getElementById('selected-images-list');
    const imageCount = mergeItems.filter(item => item.type === 'image').length;
    
    if (mergeItems.length === 0) {
        listContainer.innerHTML = '';
        document.getElementById('merge-download-btn').style.display = 'none';
        document.getElementById('merge-preview').innerHTML = '<p class="info">Add images to see preview</p>';
        const emptySelector = document.getElementById('selected-cell');
        if (emptySelector) {
            emptySelector.innerHTML = '<option value="0">No items yet</option>';
        }
        return;
    }
    
    let listHtml = '<div class="metadata-section"><div class="section-title">Items (' + mergeItems.length + ')</div>';
    listHtml += '<div style="padding: 10px;">';
    
    mergeItems.forEach((item, index) => {
        listHtml += `<div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #161b22; margin-bottom: 6px; border-radius: 4px;">`;
        
        if (item.type === 'image') {
            listHtml += `<img src="${item.dataUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 3px;">`;
            listHtml += `<div style="flex: 1; font-size: 11px; overflow: hidden;">`;
            listHtml += `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.file.name}</div>`;
            listHtml += `<div style="color: #8b949e;">${item.width}x${item.height}</div>`;
            listHtml += `</div>`;
        } else {
            listHtml += `<div style="width: 40px; height: 40px; background: ${item.color}; border: 1px solid #30363d; border-radius: 3px;"></div>`;
            listHtml += `<div style="flex: 1; font-size: 11px;">`;
            listHtml += `<div>Empty Cell</div>`;
            listHtml += `<div style="color: #8b949e;">${item.color}</div>`;
            listHtml += `</div>`;
        }
        
        listHtml += `<button onclick="removeMergeItem(${index})" style="background: #21262d; border: 1px solid #30363d; color: #f85149; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">✕</button>`;
        listHtml += `</div>`;
    });
    
    listHtml += '</div></div>';
    listContainer.innerHTML = listHtml;
    
    // Update cell selector dropdown (if present)
    const cellSelector = document.getElementById('selected-cell');
    if (cellSelector) {
        let selectorHtml = '';
        mergeItems.forEach((item, index) => {
            if (item.type === 'image') {
                selectorHtml += `<option value="${index}">Image ${index + 1} - ${item.file.name.substring(0, 20)}</option>`;
            } else {
                selectorHtml += `<option value="${index}">Empty Cell ${index + 1}</option>`;
            }
        });
        cellSelector.innerHTML = selectorHtml;
        
        // Select first item by default
        if (selectedCellIndex >= mergeItems.length) {
            selectedCellIndex = 0;
        }
        cellSelector.value = selectedCellIndex;
        selectCell(selectedCellIndex);
    }
    
    // Show download button
    document.getElementById('merge-download-btn').style.display = 'block';
    
    // Update preview
    updateMergePreview();
}

function removeMergeItem(index) {
    mergeItems.splice(index, 1);
    // If we removed an image, rebuild to maintain empty cell pattern
    if (includeEmptyCells) {
        rebuildMergeItems();
    } else {
        updateMergeUI();
    }
}

function setMergeDirection(direction) {
    if (direction === 'grid') {
        setMergeLayout('manual-grid');
    } else if (direction === 'horizontal') {
        setMergeLayout('horizontal');
    } else if (direction === 'vertical') {
        setMergeLayout('vertical');
    }
}

function setMergeLayout(mode) {
    mergeLayoutMode = mode;
    if (mode !== 'template') {
        selectedTemplateId = null;
    }
    if (mode === 'manual-grid' || mode === 'auto-grid') {
        mergeDirection = 'grid';
    } else if (mode === 'horizontal' || mode === 'vertical') {
        mergeDirection = mode;
    } else {
        mergeDirection = 'grid';
    }
    
    // Update button states
    document.querySelectorAll('[id^="merge-"], [id^="template-"], .template-card').forEach(btn => btn.classList.remove('active'));
    const modeToButtonId = {
        'auto-grid': 'merge-auto-grid',
        'manual-grid': 'merge-grid',
        'horizontal': 'merge-horizontal',
        'vertical': 'merge-vertical'
    };
    const buttonId = modeToButtonId[mode];
    if (buttonId) {
        document.getElementById(buttonId)?.classList.add('active');
    }
    
    // Show/hide grid columns only for manual grid
    const gridContainer = document.getElementById('grid-columns-container');
    if (gridContainer) {
        gridContainer.style.display = mode === 'manual-grid' ? 'block' : 'none';
    }
    
    updateMergePreview();
}

function setMergeTemplate(templateId) {
    mergeLayoutMode = 'template';
    selectedTemplateId = templateId;
    mergeDirection = 'grid';
    
    document.querySelectorAll('[id^="merge-"]').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.template-card').forEach(btn => btn.classList.remove('active'));
    
    const selectedCard = document.querySelector(`[data-template-id="${templateId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('active');
    }
    
    const gridContainer = document.getElementById('grid-columns-container');
    if (gridContainer) {
        gridContainer.style.display = 'none';
    }
    
    updateMergePreview();
}

function setImageFit(fit) {
    imageFit = fit;
    
    // Update button states
    document.querySelectorAll('[id^="fit-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById('fit-' + fit).classList.add('active');
    
    // Update description
    const descriptions = {
        'cover': 'Scales to cover entire cell, may crop edges',
        'contain': 'Scales to fit within cell, maintains aspect ratio',
        'fill': 'Stretches to fill entire cell, may distort image',
        'scale': 'Like Contain, but won\'t enlarge small images'
    };
    document.getElementById('fit-description').textContent = descriptions[fit];
    
    updateMergePreview();
}

function setFrameSize(value) {
    frameSize = Math.max(0, parseInt(value));
    document.getElementById('frame-size-value').textContent = frameSize;
    updateMergePreview();
}

function setFrameColor(color) {
    frameColor = color;
    document.getElementById('frame-color').value = color;
    document.getElementById('frame-color-text').value = color;
    updateMergePreview();
}

function updateGridColumns(value) {
    gridColumns = parseInt(value);
    document.getElementById('grid-columns-value').textContent = gridColumns;
    if (mergeLayoutMode !== 'manual-grid') {
        setMergeLayout('manual-grid');
        return;
    }
    updateMergePreview();
}

function getAutoGridColumns(count) {
    if (count <= 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    if (count <= 9) return 3;
    if (count <= 12) return 4;
    return 4;
}

function buildGridLayout(count, columns) {
    const rows = Math.max(1, Math.ceil(count / columns));
    const cells = [];
    for (let index = 0; index < count; index++) {
        const row = Math.floor(index / columns);
        const col = index % columns;
        cells.push({ index, row, col, rowSpan: 1, colSpan: 1 });
    }
    return { columns, rows, cells };
}

function buildHeroLeftLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 3,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 3, colSpan: 2 },
            { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildHeroRightLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 0, col: 1, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 3,
        cells: [
            { index: 0, row: 0, col: 1, rowSpan: 3, colSpan: 2 },
            { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 2, col: 0, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildHeroTopLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 2,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 3 },
            { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildHeroBottomLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 1, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 1, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 2,
        cells: [
            { index: 0, row: 1, col: 0, rowSpan: 1, colSpan: 3 },
            { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 0, col: 2, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildSpotlightLayout(count) {
    if (count !== 3) return null;
    return {
        columns: 2,
        rows: 2,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 1 },
            { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildSplitLayout(count) {
    if (count !== 4) return null;
    return {
        columns: 3,
        rows: 2,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 2 },
            { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 1, col: 1, rowSpan: 1, colSpan: 2 }
        ]
    };
}

function getClipPolygonArray(type) {
    if (type === 'diag-left') {
        return [[0, 0], [1, 0], [0, 1]];
    }
    if (type === 'diag-right') {
        return [[1, 0], [1, 1], [0, 1]];
    }
    if (type === 'hex') {
        return [[0.5, 0.06], [0.9, 0.28], [0.9, 0.72], [0.5, 0.94], [0.1, 0.72], [0.1, 0.28]];
    }
    if (type === 'heart') {
        return [[0.5, 0.92], [0.15, 0.58], [0.08, 0.35], [0.22, 0.18], [0.38, 0.18], [0.5, 0.3], [0.62, 0.18], [0.78, 0.18], [0.92, 0.35], [0.85, 0.58]];
    }
    return null;
}

function getClipPolygonPoints(type) {
    const points = getClipPolygonArray(type);
    if (!points) return null;
    return points.map(point => `${point[0] * 100}% ${point[1] * 100}%`).join(', ');
}

function extendLayoutWithOverflow(layout, count) {
    if (!layout || count <= layout.cells.length) {
        return layout;
    }
    const extraCount = count - layout.cells.length;
    const extraRows = Math.ceil(extraCount / layout.columns);
    const startRow = layout.rows;
    const extraCells = [];
    for (let i = 0; i < extraCount; i++) {
        const row = startRow + Math.floor(i / layout.columns);
        const col = i % layout.columns;
        extraCells.push({ index: layout.cells.length + i, row, col, rowSpan: 1, colSpan: 1 });
    }
    return {
        columns: layout.columns,
        rows: layout.rows + extraRows,
        cells: layout.cells.concat(extraCells)
    };
}

const templateLibrary = [
    {
        id: 'split-vertical',
        minImages: 2,
        maxImages: 2,
        layout: () => buildGridLayout(2, 2),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="40" height="88" rx="3"/><rect x="54" y="6" width="40" height="88" rx="3"/></svg>'
    },
    {
        id: 'split-horizontal',
        minImages: 2,
        maxImages: 2,
        layout: () => buildGridLayout(2, 1),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="40" rx="3"/><rect x="6" y="54" width="88" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-left',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroLeftLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="58" height="88" rx="3"/><rect x="70" y="6" width="24" height="40" rx="3"/><rect x="70" y="54" width="24" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-right',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroRightLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="36" y="6" width="58" height="88" rx="3"/><rect x="6" y="6" width="24" height="40" rx="3"/><rect x="6" y="54" width="24" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-top',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroTopLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="42" rx="3"/><rect x="6" y="54" width="26" height="40" rx="3"/><rect x="37" y="54" width="26" height="40" rx="3"/><rect x="68" y="54" width="26" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-bottom',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroBottomLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="40" rx="3"/><rect x="37" y="6" width="26" height="40" rx="3"/><rect x="68" y="6" width="26" height="40" rx="3"/><rect x="6" y="54" width="88" height="40" rx="3"/></svg>'
    },
    {
        id: 'spotlight',
        minImages: 3,
        maxImages: 3,
        layout: (count) => buildSpotlightLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="44" height="88" rx="3"/><rect x="56" y="6" width="38" height="40" rx="3"/><rect x="56" y="54" width="38" height="40" rx="3"/></svg>'
    },
    {
        id: 'split-mix',
        minImages: 4,
        maxImages: 4,
        layout: (count) => buildSplitLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="56" height="40" rx="3"/><rect x="66" y="6" width="28" height="40" rx="3"/><rect x="6" y="54" width="28" height="40" rx="3"/><rect x="38" y="54" width="56" height="40" rx="3"/></svg>'
    },
    {
        id: 'quad-grid',
        minImages: 4,
        maxImages: 4,
        layout: () => buildGridLayout(4, 2),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="40" height="40" rx="3"/><rect x="54" y="6" width="40" height="40" rx="3"/><rect x="6" y="54" width="40" height="40" rx="3"/><rect x="54" y="54" width="40" height="40" rx="3"/></svg>'
    },
    {
        id: 'diagonal-split',
        minImages: 2,
        maxImages: 2,
        layout: () => ({
            columns: 2,
            rows: 1,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1, clip: 'diag-left' },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1, clip: 'diag-right' }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="6,6 94,6 6,94" /><polygon points="94,6 94,94 6,94" /></svg>'
    },
    {
        id: 'hex-focus',
        minImages: 1,
        maxImages: 1,
        layout: () => ({
            columns: 1,
            rows: 1,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1, clip: 'hex' }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="50,8 90,30 90,70 50,92 10,70 10,30"/></svg>'
    },
    {
        id: 'heart-focus',
        minImages: 1,
        maxImages: 1,
        layout: () => ({
            columns: 1,
            rows: 1,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1, clip: 'heart' }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 86 L18 54 C8 44 8 28 22 20 C32 14 44 18 50 28 C56 18 68 14 78 20 C92 28 92 44 82 54 Z"/></svg>'
    }
];

function renderTemplateLibrary() {
    const container = document.getElementById('template-grid');
    if (!container) return;
    
    let html = '';
    templateLibrary.forEach(template => {
        html += `
            <button class="tab-button template-card" data-template-id="${template.id}" onclick="setMergeTemplate('${template.id}')" style="display: flex; flex-direction: column; gap: 6px; padding: 8px; text-align: left; font-size: 10px;">
                <div style="background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 6px; display: flex; align-items: center; justify-content: center; height: 70px;">
                    <div style="width: 100%; height: 100%; color: #c9d1d9;">${template.thumbnail}</div>
                </div>
            </button>
        `;
    });
    container.innerHTML = html;
}

renderTemplateLibrary();

function getLayoutConfig(count) {
    if (count === 0) {
        return { columns: 1, rows: 1, cells: [] };
    }

    if (mergeLayoutMode === 'template' && selectedTemplateId) {
        const template = templateLibrary.find(item => item.id === selectedTemplateId);
        if (template) {
            if (count < template.minImages) {
                return buildGridLayout(count, getAutoGridColumns(count));
            }
            const baseCount = Math.min(count, template.maxImages);
            const layout = template.layout(baseCount);
            if (layout) {
                return extendLayoutWithOverflow(layout, count);
            }
        }
        return buildGridLayout(count, getAutoGridColumns(count));
    }
    
    if (mergeLayoutMode === 'horizontal') {
        return buildGridLayout(count, count);
    }
    if (mergeLayoutMode === 'vertical') {
        return { columns: 1, rows: count, cells: buildGridLayout(count, 1).cells };
    }
    if (mergeLayoutMode === 'manual-grid') {
        return buildGridLayout(count, Math.max(1, gridColumns));
    }
    if (mergeLayoutMode === 'hero-left') {
        return buildHeroLeftLayout(count) || buildGridLayout(count, getAutoGridColumns(count));
    }
    if (mergeLayoutMode === 'hero-top') {
        return buildHeroTopLayout(count) || buildGridLayout(count, getAutoGridColumns(count));
    }
    if (mergeLayoutMode === 'spotlight') {
        return buildSpotlightLayout(count) || buildGridLayout(count, getAutoGridColumns(count));
    }
    if (mergeLayoutMode === 'split') {
        return buildSplitLayout(count) || buildGridLayout(count, getAutoGridColumns(count));
    }
    
    // auto-grid (default)
    return buildGridLayout(count, getAutoGridColumns(count));
}

function calculateMergeDimensions() {
    if (mergeItems.length === 0) return null;
    
    // Find max dimensions for cell sizing (only from images)
    let cellWidth = 0, cellHeight = 0;
    mergeItems.forEach(item => {
        if (item.type === 'image') {
            cellWidth = Math.max(cellWidth, item.width);
            cellHeight = Math.max(cellHeight, item.height);
        }
    });
    
    // Default cell size if no images
    if (cellWidth === 0) cellWidth = 800;
    if (cellHeight === 0) cellHeight = 600;
    
    const layout = getLayoutConfig(mergeItems.length);
    const canvasWidth = cellWidth * layout.columns;
    const canvasHeight = cellHeight * layout.rows;
    
    return { width: canvasWidth, height: canvasHeight, cellWidth, cellHeight, layout };
}

function updateMergePreview() {
    const preview = document.getElementById('merge-preview');
    
    if (mergeItems.length === 0) {
        preview.style.display = 'flex';
        preview.style.alignItems = 'center';
        preview.style.justifyContent = 'center';
        preview.innerHTML = `
            <div style="text-align: center;">
                <div class="upload-icon" style="font-size: 48px; margin-bottom: 20px;">[   ]</div>
                <div style="font-size: 14px; color: #c9d1d9; margin-bottom: 10px;">Click or drag files here to merge</div>
                <div class="info" style="font-size: 11px;">
                    Supports: JPEG, PNG, TIFF, HEIC<br>
                    All processing happens in your browser
                </div>
            </div>
        `;
        document.getElementById('output-dimensions').style.display = 'none';
        return;
    }
    
    // Reset to normal display for preview grid
    preview.style.display = 'block';
    preview.style.alignItems = '';
    preview.style.justifyContent = '';
    
    const dims = calculateMergeDimensions();
    
    // Show final dimensions
    const dimsDisplay = document.getElementById('output-dimensions');
    dimsDisplay.style.display = 'block';
    document.getElementById('dimensions-text').textContent = `${dims.width} × ${dims.height}px`;
    
    // Calculate preview container aspect ratio to match final output
    const aspectRatio = dims.width / dims.height;
    const maxWidth = 900; // max preview width
    const maxHeight = 600; // max preview height
    
    let previewWidth, previewHeight;
    if (aspectRatio > maxWidth / maxHeight) {
        // Width constrained
        previewWidth = maxWidth;
        previewHeight = maxWidth / aspectRatio;
    } else {
        // Height constrained
        previewHeight = maxHeight;
        previewWidth = maxHeight * aspectRatio;
    }
    
    const layout = dims.layout || getLayoutConfig(mergeItems.length);
    
    // Build grid style based on layout
    let gridStyle = `display: grid; gap: 2px; width: ${previewWidth}px; height: ${previewHeight}px; margin: 0 auto;`;
    gridStyle += ` grid-template-columns: repeat(${layout.columns}, 1fr); grid-template-rows: repeat(${layout.rows}, 1fr);`;
    
    let html = `<div style="${gridStyle}">`;
    
    mergeItems.forEach((item, index) => {
        const cell = layout.cells[index];
        if (!cell) return;
        
        const frameSizePreview = Math.max(0, Math.round(frameSize * (previewWidth / dims.width)));
        const cellStyle = `
            grid-column: ${cell.col + 1} / span ${cell.colSpan};
            grid-row: ${cell.row + 1} / span ${cell.rowSpan};
        `;
        html += `<div class="merge-cell" data-merge-cell="${index}" style="border: 1px solid #30363d; overflow: hidden; background: ${frameColor}; position: relative; display: flex; align-items: stretch; justify-content: stretch; padding: ${frameSizePreview}px; ${cellStyle}">`;
        const clipPoints = cell.clip ? getClipPolygonPoints(cell.clip) : null;
        const clipStyle = clipPoints ? `clip-path: polygon(${clipPoints}); -webkit-clip-path: polygon(${clipPoints});` : '';
        html += `<div style="position: relative; width: 100%; height: 100%; background: ${item.type === 'empty' ? item.color : '#000'}; overflow: hidden; ${clipStyle}">`;
        
        if (item.type === 'image') {
            const fitStyle = imageFit === 'cover' ? 'cover' : imageFit === 'contain' ? 'contain' : imageFit === 'fill' ? 'fill' : 'scale-down';
            const posX = item.imageOffsetX ?? 50;
            const posY = item.imageOffsetY ?? 50;
            html += `<img src="${item.dataUrl}" class="merge-image" data-cell-index="${index}" style="width: 100%; height: 100%; object-fit: ${fitStyle}; object-position: ${posX}% ${posY}%; position: absolute; top: 0; left: 0; cursor: ${imageFit === 'cover' ? 'grab' : 'default'};">`;
        }
        
        // Render text overlay if present
        if (item.text && item.text.content) {
            const textStyle = `
                position: absolute;
                color: ${item.text.color};
                font-family: ${item.text.font};
                font-size: ${Math.max(6, item.text.size * (previewWidth / dims.width))}px;
                opacity: ${item.text.opacity};
                white-space: pre-wrap;
                text-align: center;
                padding: 10px;
                max-width: 90%;
                word-wrap: break-word;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                cursor: move;
                user-select: none;
                pointer-events: auto;
            `;
            
            let positionStyle = '';
            
            // Check if custom position exists
            if (item.text.customX !== undefined && item.text.customY !== undefined) {
                positionStyle = `left: ${item.text.customX}%; top: ${item.text.customY}%; transform: translate(-50%, -50%);`;
            } else {
                // Use preset positions
                switch(item.text.position) {
                    case 'top':
                        positionStyle = 'top: 10px; left: 50%; transform: translateX(-50%);';
                        break;
                    case 'bottom':
                        positionStyle = 'bottom: 10px; left: 50%; transform: translateX(-50%);';
                        break;
                    case 'left':
                        positionStyle = 'left: 10px; top: 50%; transform: translateY(-50%); text-align: left;';
                        break;
                    case 'right':
                        positionStyle = 'right: 10px; top: 50%; transform: translateY(-50%); text-align: right;';
                        break;
                    default: // center
                        positionStyle = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
                }
            }
            
            html += `<div class="draggable-text" data-cell-index="${index}" onmousedown="handleTextMouseDown(event, ${index})" style="${textStyle} ${positionStyle}">${escapeHtml(item.text.content)}</div>`;
        }
        html += `</div>`;
        html += `</div>`;
    });
    
    html += '</div>';
    preview.innerHTML = html;
}

// Text Edit Modal Functions
function openTextModal(cellIndex) {
    if (isDraggingText) return; // Don't open if we're dragging
    
    modalCellIndex = cellIndex;
    const modal = document.getElementById('text-edit-modal');
    
    // Load current text and settings
    if (cellIndex >= 0 && cellIndex < mergeItems.length) {
        const textConfig = mergeItems[cellIndex].text;
        document.getElementById('modal-text-input').value = textConfig.content || '';
        document.getElementById('modal-text-font').value = textConfig.font;
        document.getElementById('modal-text-size').value = textConfig.size;
        document.getElementById('modal-text-size-value').textContent = textConfig.size;
        document.getElementById('modal-text-color').value = textConfig.color;
        document.getElementById('modal-text-color-text').value = textConfig.color;
        document.getElementById('modal-text-opacity').value = Math.round(textConfig.opacity * 100);
        document.getElementById('modal-text-opacity-value').textContent = Math.round(textConfig.opacity * 100);
    }
    
    // Show modal
    modal.style.display = 'flex';
    document.getElementById('modal-text-input').focus();
    document.getElementById('modal-text-input').select();
    
    // Setup modal dragging
    const modalContent = document.getElementById('modal-content');
    const modalHeader = document.getElementById('modal-header');
    
    modalHeader.onmousedown = function(e) {
        isDraggingModal = true;
        const rect = modalContent.getBoundingClientRect();
        modalOffsetX = e.clientX - rect.left;
        modalOffsetY = e.clientY - rect.top;
    };
    
    // Setup live updates
    document.getElementById('modal-text-size').oninput = function(e) {
        document.getElementById('modal-text-size-value').textContent = e.target.value;
    };
    
    document.getElementById('modal-text-opacity').oninput = function(e) {
        document.getElementById('modal-text-opacity-value').textContent = e.target.value;
    };
    
    document.getElementById('modal-text-color').onchange = function(e) {
        document.getElementById('modal-text-color-text').value = e.target.value;
    };
    
    document.getElementById('modal-text-color-text').onchange = function(e) {
        document.getElementById('modal-text-color').value = e.target.value;
    };
    
    // Handle Escape key
    document.getElementById('modal-text-input').onkeydown = function(e) {
        if (e.key === 'Escape') {
            closeTextModal(false);
        }
    };
}

function closeTextModal(save) {
    const modal = document.getElementById('text-edit-modal');
    
    if (save && modalCellIndex >= 0 && modalCellIndex < mergeItems.length) {
        // Save all settings
        mergeItems[modalCellIndex].text.content = document.getElementById('modal-text-input').value;
        mergeItems[modalCellIndex].text.font = document.getElementById('modal-text-font').value;
        mergeItems[modalCellIndex].text.size = parseInt(document.getElementById('modal-text-size').value);
        mergeItems[modalCellIndex].text.color = document.getElementById('modal-text-color').value;
        mergeItems[modalCellIndex].text.opacity = parseInt(document.getElementById('modal-text-opacity').value) / 100;
        
        updateMergePreview();
    }
    
    modal.style.display = 'none';
    modalCellIndex = -1;
    
    // Clean up
    const modalContent = document.getElementById('modal-content');
    modalContent.style.left = '';
    modalContent.style.top = '';
    modalContent.style.transform = '';
}

// Output Size Modal Functions
function openOutputSizeModal() {
    if (mergeItems.length === 0) return;
    
    const dims = calculateMergeDimensions();
    const modal = document.getElementById('output-size-modal');
    
    // Show current dimensions
    document.getElementById('output-size-current').textContent = `${dims.width} × ${dims.height}px`;
    
    // Update preview based on current scale
    updateOutputSizePreview();
    
    // Reset to 100% scale
    outputScale = 1.0;
    document.querySelectorAll('[id^="scale-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById('scale-100').classList.add('active');
    document.getElementById('custom-scale-input').style.display = 'none';
    
    modal.style.display = 'flex';
}

function closeOutputSizeModal() {
    document.getElementById('output-size-modal').style.display = 'none';
}

function setOutputScale(scale) {
    // Update button states
    document.querySelectorAll('[id^="scale-"]').forEach(btn => btn.classList.remove('active'));
    
    if (scale === 'custom') {
        document.getElementById('scale-custom').classList.add('active');
        document.getElementById('custom-scale-input').style.display = 'block';
        outputScale = parseFloat(document.getElementById('custom-scale-slider').value) / 100;
    } else {
        document.getElementById('scale-' + (scale * 100)).classList.add('active');
        document.getElementById('custom-scale-input').style.display = 'none';
        outputScale = scale;
    }
    
    updateOutputSizePreview();
}

function updateCustomScale(value) {
    outputScale = parseFloat(value) / 100;
    document.getElementById('custom-scale-value').textContent = value;
    document.getElementById('custom-scale-slider').value = value;
    document.getElementById('custom-scale-number').value = value;
    updateOutputSizePreview();
}

function updateOutputSizePreview() {
    const dims = calculateMergeDimensions();
    const scaledWidth = Math.round(dims.width * outputScale);
    const scaledHeight = Math.round(dims.height * outputScale);
    const scaledSize = Math.round((scaledWidth * scaledHeight * 4) / (1024 * 1024)); // Rough MB estimate
    
    document.getElementById('output-size-preview').textContent = 
        `Scaled: ${scaledWidth} × ${scaledHeight}px (~${scaledSize}MB)`;
}

function proceedWithDownload() {
    closeOutputSizeModal();
    downloadMergedImage();
}

// Setup modal dragging globally
document.addEventListener('mousemove', function(e) {
    if (isDraggingModal) {
        const modalContent = document.getElementById('modal-content');
        modalContent.style.position = 'fixed';
        modalContent.style.left = (e.clientX - modalOffsetX) + 'px';
        modalContent.style.top = (e.clientY - modalOffsetY) + 'px';
        modalContent.style.transform = 'none';
    }
});

document.addEventListener('mouseup', function() {
    if (isDraggingModal) {
        isDraggingModal = false;
    }
});

// Close modal when clicking outside
document.getElementById('text-edit-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeTextModal(false);
    }
});

async function downloadMergedImage() {
    if (mergeItems.length === 0) return;
    
    // Calculate canvas dimensions using shared function
    const dims = calculateMergeDimensions();
    
    // Apply output scale
    const canvasWidth = Math.round(dims.width * outputScale);
    const canvasHeight = Math.round(dims.height * outputScale);
    const baseCellWidth = Math.round(dims.cellWidth * outputScale);
    const baseCellHeight = Math.round(dims.cellHeight * outputScale);
    const frameSizeOutput = Math.max(0, Math.round(frameSize * outputScale));
    const layout = dims.layout || getLayoutConfig(mergeItems.length);
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw items (images and empty cells)
    mergeItems.forEach((item, index) => {
        const cell = layout.cells[index];
        if (!cell) return;
        
        const x = cell.col * baseCellWidth;
        const y = cell.row * baseCellHeight;
        const cellWidth = baseCellWidth * cell.colSpan;
        const cellHeight = baseCellHeight * cell.rowSpan;
        const innerX = x + frameSizeOutput;
        const innerY = y + frameSizeOutput;
        const innerWidth = Math.max(1, cellWidth - frameSizeOutput * 2);
        const innerHeight = Math.max(1, cellHeight - frameSizeOutput * 2);
        
        // Draw frame
        if (frameSizeOutput > 0) {
            ctx.fillStyle = frameColor;
            ctx.fillRect(x, y, cellWidth, cellHeight);
        }
        
        const clipPoints = cell.clip ? getClipPolygonArray(cell.clip) : null;
        if (clipPoints) {
            ctx.save();
            ctx.beginPath();
            clipPoints.forEach((point, idx) => {
                const px = innerX + (point[0] * innerWidth);
                const py = innerY + (point[1] * innerHeight);
                if (idx === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            });
            ctx.closePath();
            ctx.clip();
        }
        
        if (item.type === 'image') {
            // Draw image
            if (imageFit === 'cover' || imageFit === 'contain') {
                const scale = imageFit === 'cover' 
                    ? Math.max(innerWidth / item.width, innerHeight / item.height)
                    : Math.min(innerWidth / item.width, innerHeight / item.height);
                
                const scaledWidth = item.width * scale;
                const scaledHeight = item.height * scale;
                const posX = item.imageOffsetX ?? 50;
                const posY = item.imageOffsetY ?? 50;
                const offsetX = (innerWidth - scaledWidth) * (posX / 100);
                const offsetY = (innerHeight - scaledHeight) * (posY / 100);
                
                ctx.drawImage(item.img, innerX + offsetX, innerY + offsetY, scaledWidth, scaledHeight);
            } else { // fill or scale-down
                ctx.drawImage(item.img, innerX, innerY, innerWidth, innerHeight);
            }
        } else {
            // Draw empty cell
            ctx.fillStyle = item.color;
            ctx.fillRect(innerX, innerY, innerWidth, innerHeight);
        }
        
        if (clipPoints) {
            ctx.restore();
        }
        
        // Draw text overlay if present
        if (item.text && item.text.content) {
            ctx.save();
            ctx.font = `${item.text.size}px ${item.text.font}`;
            ctx.fillStyle = item.text.color;
            ctx.globalAlpha = item.text.opacity;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add text shadow for better visibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // Calculate text position
            let textX, textY;
            const padding = 20;
            
            // Check for custom position first
            if (item.text.customX !== undefined && item.text.customY !== undefined) {
                textX = x + (cellWidth * item.text.customX / 100);
                textY = y + (cellHeight * item.text.customY / 100);
            } else {
                // Use preset positions
                switch(item.text.position) {
                    case 'top':
                        textX = x + cellWidth / 2;
                        textY = y + item.text.size + padding;
                        break;
                    case 'bottom':
                        textX = x + cellWidth / 2;
                        textY = y + cellHeight - padding;
                        break;
                    case 'left':
                        textX = x + padding;
                        textY = y + cellHeight / 2;
                        ctx.textAlign = 'left';
                        break;
                    case 'right':
                        textX = x + cellWidth - padding;
                        textY = y + cellHeight / 2;
                        ctx.textAlign = 'right';
                        break;
                    default: // center
                        textX = x + cellWidth / 2;
                        textY = y + cellHeight / 2;
                }
            }
            
            // Wrap text if too long
            const maxWidth = cellWidth - (padding * 2);
            const words = item.text.content.split(' ');
            let lines = [];
            let currentLine = words[0];
            
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + ' ' + words[i];
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth) {
                    lines.push(currentLine);
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }
            lines.push(currentLine);
            
            // Draw each line
            const lineHeight = item.text.size * 1.2;
            const totalHeight = lines.length * lineHeight;
            let startY = textY - (totalHeight / 2) + (lineHeight / 2);
            
            if (item.text.position === 'top') {
                startY = textY;
            } else if (item.text.position === 'bottom') {
                startY = textY - totalHeight + lineHeight;
            }
            
            lines.forEach((line, i) => {
                ctx.fillText(line, textX, startY + (i * lineHeight));
            });
            
            ctx.restore();
        }
    });
    
    // Download
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `merged_${mergeLayoutMode}_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}
