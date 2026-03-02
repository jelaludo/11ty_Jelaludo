// Shared cross-tab state (written here, read by image merger)
let imageMetadataCache = new Map(); // Maps file.name -> {metadata, file, timestamp}

// Global state
let currentFile = null;
let currentMetadata = null;

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
    
    // Reset image merger if switching away
    if (tabName !== 'collage') {
        // Keep merger state
    }
}

// File upload handling
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const output = document.getElementById('output');
const parsingFlowPanel = document.getElementById('parsingFlowPanel');
let isParsingFlowVisible = false;

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
});

function resetParsingFlowView() {
    isParsingFlowVisible = false;
    if (parsingFlowPanel) {
        parsingFlowPanel.classList.remove('active');
    }
    const metadataBody = document.getElementById('metadataBody');
    if (metadataBody) {
        metadataBody.style.display = 'block';
    }
    const toggleBtn = document.getElementById('parsingFlowToggle');
    if (toggleBtn) {
        toggleBtn.textContent = '[ Parsing Flow ]';
    }
    const backBtn = document.getElementById('parsingFlowBack');
    if (backBtn) {
        backBtn.style.display = 'none';
    }
}

function toggleParsingFlow() {
    const metadataBody = document.getElementById('metadataBody');
    if (!parsingFlowPanel || !metadataBody) {
        return;
    }
    isParsingFlowVisible = !isParsingFlowVisible;
    if (isParsingFlowVisible) {
        parsingFlowPanel.classList.add('active');
        metadataBody.style.display = 'none';
    } else {
        parsingFlowPanel.classList.remove('active');
        metadataBody.style.display = 'block';
    }
    const toggleBtn = document.getElementById('parsingFlowToggle');
    if (toggleBtn) {
        toggleBtn.textContent = '[ Parsing Flow ]';
    }
    const backBtn = document.getElementById('parsingFlowBack');
    if (backBtn) {
        backBtn.style.display = isParsingFlowVisible ? 'inline-block' : 'none';
    }
}

// Main file processing function
async function processFile(file) {
    currentFile = file;
    output.innerHTML = '<div class="output-line"><span class="prompt">$</span> Analyzing file...</div>';
    
    try {
        // Show image preview inside upload zone
        const zonePreview = document.getElementById('upload-zone-preview');
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                zonePreview.src = e.target.result;
                uploadZone.classList.add('has-preview');
            };
            reader.readAsDataURL(file);
        } else {
            zonePreview.src = '';
            uploadZone.classList.remove('has-preview');
        }
        
        // Extract metadata
        const metadata = await extractMetadata(file);
        currentMetadata = metadata;
        
        // Cache metadata for potential use in Image Merger
        imageMetadataCache.set(file.name, {
            metadata: metadata,
            file: file,
            timestamp: Date.now()
        });
        
        // Display results
        displayMetadata(metadata);
        
        // Update chunks visualization
        if (metadata.chunks) {
            updateChunksVisualization(metadata.chunks, file);
        }
        
    } catch (error) {
        output.innerHTML += `<div class="output-line error">Error: ${error.message}</div>`;
        console.error('Processing error:', error);
    }
}

// Calculate PNG structure data
function calculatePngStructure(chunks, totalSize) {
    if (!chunks || chunks.length === 0) return null;
    
    let pixelDataBytes = 0;
    let nonPixelBytes = 8; // PNG signature
    
    // Calculate bytes for each chunk type
    for (const chunk of chunks) {
        const chunkTotalSize = chunk.length + 12; // length (4) + type (4) + data + crc (4)
        
        if (chunk.type === 'IDAT') {
            pixelDataBytes += chunkTotalSize;
        } else {
            nonPixelBytes += chunkTotalSize;
        }
    }
    
    return {
        format: 'PNG',
        totalChunks: chunks.length,
        pixelDataBytes: pixelDataBytes,
        nonPixelBytes: nonPixelBytes,
        nonPixelRatio: (nonPixelBytes / totalSize).toFixed(4),
        chunks: chunks.map(c => ({
            type: c.type,
            offset: c.offset,
            size: c.length,
            hasData: c.length > 0
        }))
    };
}

// Calculate JPEG structure data
function calculateJpegStructure(segments, totalSize) {
    if (!segments || segments.length === 0) return null;
    
    let pixelDataBytes = 0;
    let nonPixelBytes = 0;
    
    for (const segment of segments) {
        if (segment.type === '0xFFDA') { // SOS (Start of Scan) - contains pixel data
            pixelDataBytes += segment.length || 0;
        } else {
            nonPixelBytes += (segment.length || 0) + 2; // marker (2 bytes)
        }
    }
    
    return {
        format: 'JPEG',
        totalSegments: segments.length,
        pixelDataBytes: pixelDataBytes,
        nonPixelBytes: nonPixelBytes,
        nonPixelRatio: (nonPixelBytes / totalSize).toFixed(4),
        segments: segments.map(s => ({
            type: s.type,
            typeName: s.typeName,
            offset: s.offset,
            size: s.length,
            hasData: (s.length || 0) > 0
        }))
    };
}

// Calculate anomalies
function calculateAnomalies(metadata) {
    const anomalies = {
        fileSize: metadata.fileSize,
        pixelDataBytes: metadata.structure?.pixelDataBytes || 0,
        nonPixelBytes: metadata.structure?.nonPixelBytes || 0,
        nonPixelRatio: metadata.structure?.nonPixelRatio || 0,
        flags: []
    };
    
    // Check for custom chunks (PNG)
    if (metadata.chunks) {
        const standardPngChunks = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'tEXt', 'zTXt', 'iTXt', 'bKGD', 'pHYs', 'sBIT', 'sPLT', 'hIST', 'tIME'];
        const customChunks = metadata.chunks.filter(c => !standardPngChunks.includes(c.type));
        if (customChunks.length > 0) {
            anomalies.flags.push('custom_chunks_present');
        }
    }
    
    // Check for high metadata ratio
    if (parseFloat(anomalies.nonPixelRatio) > 0.2) {
        anomalies.flags.push('high_metadata_ratio');
    }
    
    // Check for AI metadata
    if (metadata.aiMetadata?.hasComfyUI || metadata.aiMetadata?.hasStableDiffusion) {
        anomalies.flags.push('ai_metadata_present');
    }
    
    return anomalies;
}

// Metadata extraction (pure JavaScript)
async function extractMetadata(file) {
    const result = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        containerType: getContainerType(file),
    };
    
    // Extract EXIF/IPTC/XMP using exifr
    try {
        const exifData = await exifr.parse(file, {
            tiff: true,
            exif: true,
            gps: true,
            iptc: true,
            icc: true,
            jfif: true,
            ihdr: true,
            translateKeys: false,
            translateValues: false,
            reviveValues: true,
            sanitize: false,
            mergeOutput: false,
        });
        
        if (exifData) {
            result.exif = exifData;
        }
        
        // GPS coordinates
        const gps = await exifr.gps(file);
        if (gps) {
            result.gps = {
                latitude: gps.latitude,
                longitude: gps.longitude,
                formatted: `${gps.latitude}, ${gps.longitude}`
            };
        }
        
    } catch (error) {
        console.warn('EXIF extraction error:', error);
    }
    
    // Parse file structure (PNG chunks, JPEG segments, etc.)
    const arrayBuffer = await file.arrayBuffer();
    
    if (file.name.toLowerCase().endsWith('.png')) {
        result.chunks = await parsePngChunks(arrayBuffer);
        result.pngTextChunks = extractPngTextChunks(result.chunks);
        
        // Calculate structure data
        result.structure = calculatePngStructure(result.chunks, file.size);
    } else if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg')) {
        result.chunks = await parseJpegSegments(arrayBuffer);
        
        // Calculate structure data for JPEG
        result.structure = calculateJpegStructure(result.chunks, file.size);
    }
    
    // Detect AI metadata
    result.aiMetadata = detectAIMetadata(result);
    
    // Determine provenance
    result.provenance = determineProvenance(result);
    
    // Calculate anomalies
    result.anomalies = calculateAnomalies(result);
    
    return result;
}

// PNG chunk parser
async function parsePngChunks(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const chunks = [];
    
    // Check PNG signature
    if (view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
        throw new Error('Not a valid PNG file');
    }
    
    let offset = 8; // Skip PNG signature
    
    while (offset < arrayBuffer.byteLength - 12) {
        const length = view.getUint32(offset);
        offset += 4;
        
        const typeBytes = new Uint8Array(arrayBuffer, offset, 4);
        const chunkType = String.fromCharCode(...typeBytes);
        offset += 4;
        
        const data = new Uint8Array(arrayBuffer, offset, length);
        offset += length;
        
        const crc = view.getUint32(offset);
        offset += 4;
        
        chunks.push({
            type: chunkType,
            length: length,
            data: data,
            offset: offset - length - 12,
            crc: crc
        });
        
        if (chunkType === 'IEND') break;
    }
    
    return chunks;
}

// JPEG segment parser (simplified)
async function parseJpegSegments(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const segments = [];
    
    let offset = 0;
    
    // Check JPEG signature
    if (view.getUint16(0) !== 0xFFD8) {
        throw new Error('Not a valid JPEG file');
    }
    
    offset = 2;
    
    while (offset < arrayBuffer.byteLength - 4) {
        const marker = view.getUint16(offset);
        
        if ((marker & 0xFF00) !== 0xFF00) break;
        
        offset += 2;
        
        // Markers without length
        if (marker === 0xFFD8 || marker === 0xFFD9 || (marker >= 0xFFD0 && marker <= 0xFFD7)) {
            segments.push({
                type: `0x${marker.toString(16).toUpperCase()}`,
                length: 0,
                offset: offset - 2
            });
            continue;
        }
        
        const length = view.getUint16(offset);
        
        segments.push({
            type: `0x${marker.toString(16).toUpperCase()}`,
            typeName: getJpegMarkerName(marker),
            length: length,
            offset: offset - 2
        });
        
        offset += length;
    }
    
    return segments;
}

function getJpegMarkerName(marker) {
    const names = {
        0xFFC0: 'SOF0 (Baseline DCT)',
        0xFFC4: 'DHT (Huffman Table)',
        0xFFD8: 'SOI (Start of Image)',
        0xFFD9: 'EOI (End of Image)',
        0xFFDA: 'SOS (Start of Scan)',
        0xFFDB: 'DQT (Quantization Table)',
        0xFFE0: 'APP0 (JFIF)',
        0xFFE1: 'APP1 (EXIF/XMP)',
        0xFFE2: 'APP2 (ICC Profile)',
        0xFFFE: 'COM (Comment)',
    };
    return names[marker] || 'Unknown';
}

// Extract text from PNG text chunks
function extractPngTextChunks(chunks) {
    if (!chunks) return null;
    
    const textChunks = [];
    const decoder = new TextDecoder('utf-8');
    
    
    for (const chunk of chunks) {
        
        if (chunk.type === 'tEXt' || chunk.type === 'iTXt' || chunk.type === 'zTXt') {
            try {
                // Find null terminator (keyword/text separator)
                let nullIndex = 0;
                while (nullIndex < chunk.data.length && chunk.data[nullIndex] !== 0) {
                    nullIndex++;
                }
                
                const keyword = decoder.decode(chunk.data.slice(0, nullIndex));
                let text = '';
                
                if (chunk.type === 'tEXt') {
                    text = decoder.decode(chunk.data.slice(nullIndex + 1));
                } else if (chunk.type === 'iTXt') {
                    // iTXt format: keyword, null, compression flag, compression method, language tag, null, translated keyword, null, text
                    let offset = nullIndex + 1;
                    const compressionFlag = chunk.data[offset];
                    offset += 1; // Skip compression flag
                    offset += 1; // Skip compression method
                    
                    // Skip language tag (find next null)
                    while (offset < chunk.data.length && chunk.data[offset] !== 0) {
                        offset++;
                    }
                    offset++; // Skip the null
                    
                    // Skip translated keyword (find next null)
                    while (offset < chunk.data.length && chunk.data[offset] !== 0) {
                        offset++;
                    }
                    offset++; // Skip the null
                    
                    // Now we have the actual text
                    const textData = chunk.data.slice(offset);
                    
                    // Check if compressed (compressionFlag === 1)
                    if (compressionFlag === 1 && typeof pako !== 'undefined') {
                        try {
                            const decompressed = pako.inflate(textData);
                            text = decoder.decode(decompressed);
                        } catch (e) {
                            console.warn('Failed to decompress iTXt chunk:', e);
                            text = decoder.decode(textData);
                        }
                    } else {
                        text = decoder.decode(textData);
                    }
                } else if (chunk.type === 'zTXt') {
                    // zTXt: keyword, null, compression method (1 byte), compressed data
                    const compressionMethod = chunk.data[nullIndex + 1];
                    const compressedData = chunk.data.slice(nullIndex + 2);
                    
                    if (typeof pako !== 'undefined') {
                        try {
                            const decompressed = pako.inflate(compressedData);
                            text = decoder.decode(decompressed);
                        } catch (e) {
                            console.warn('Failed to decompress zTXt chunk:', e);
                            text = decoder.decode(compressedData);
                        }
                    } else {
                        console.warn('pako not loaded, cannot decompress zTXt chunk');
                        text = decoder.decode(compressedData);
                    }
                }
                
                textChunks.push({ keyword, text, type: chunk.type });
                if (keyword.toLowerCase().includes('prompt') || keyword.toLowerCase().includes('workflow')) {
                }
            } catch (e) {
                console.warn('Error parsing text chunk:', e);
            }
        }
    }
    
    return textChunks.length > 0 ? textChunks : null;
}

// AI metadata detection
function detectAIMetadata(metadata) {
    const ai = {
        hasComfyUI: false,
        hasStableDiffusion: false,
        model: null,
        prompt: null,
        negativePrompt: null,
        resolvedPrompt: null,
        workflow: null,
        wildcards: [],
        loras: [],
        sampler: null,
        steps: null,
        cfgScale: null,
        seed: null
    };
    
    // Check EXIF software tag
    if (metadata.exif) {
        const software = metadata.exif.Software || metadata.exif.software;
        if (software) {
            if (typeof software === 'string' && software.toLowerCase().includes('comfy')) {
                ai.hasComfyUI = true;
            }
            if (typeof software === 'string' && software.toLowerCase().includes('stable')) {
                ai.hasStableDiffusion = true;
            }
        }
        
        // Check for model in parameters
        const params = metadata.exif.Parameters || metadata.exif.parameters;
        if (params && typeof params === 'string') {
            const modelMatch = params.match(/Model:\s*([^\n,]+)/i);
            if (modelMatch) {
                ai.model = modelMatch[1].trim();
            }
        }
    }
    
    // Check PNG text chunks for workflow
    if (metadata.pngTextChunks) {
        
        let workflowData = null;
        let originalPrompt = null;
        let promptFromNodes = null;
        
        // First pass: collect all prompts and workflow data
        for (const chunk of metadata.pngTextChunks) {
            const keyLower = chunk.keyword.toLowerCase();
            
            
            // Check for prompt FIRST - could be JSON (workflow nodes) or text
            if (keyLower === 'prompt') {
                try {
                    const promptData = JSON.parse(chunk.text);
                    if (promptData && typeof promptData === 'object') {
                        // This is workflow nodes JSON - PRIORITIZE THIS!
                        workflowData = promptData;
                        ai.workflow = workflowData;
                        ai.hasComfyUI = true;
                    }
                } catch (e) {
                    // It's a text prompt - this is likely the original with wildcards
                    if (!originalPrompt) {
                        originalPrompt = chunk.text;
                    }
                }
            }
            
            // Check for workflow JSON (but don't overwrite if we have prompt data)
            if (keyLower.includes('workflow') || keyLower === 'workflow') {
                ai.hasComfyUI = true;
                try {
                    const workflowJSON = JSON.parse(chunk.text);
                    // Only use workflow chunk if we don't have prompt chunk data
                    if (!workflowData) {
                        workflowData = workflowJSON;
                        ai.workflow = workflowData;
                    } else {
                    }
                } catch (e) {
                }
            }
            
            // Check for resolved prompt
            if (keyLower.includes('resolved') || keyLower === 'prompt_resolved') {
                ai.resolvedPrompt = chunk.text;
            }
            
            // Check for negative prompt
            if (keyLower.includes('negative')) {
                ai.negativePrompt = chunk.text;
            }
        }
        
        // Extract data from workflow nodes
        if (workflowData) {
            const nodes = workflowData.nodes || workflowData;
            
            if (nodes && typeof nodes === 'object') {
                let nodeCount = 0;
                for (const [nodeId, node] of Object.entries(nodes)) {
                    if (!node || typeof node !== 'object') continue;
                    
                    if (nodeCount < 2) { // Log first 2 nodes fully
                    }
                    nodeCount++;
                    if (!node || typeof node !== 'object') continue;
                    
                    // Extract data from node inputs (regardless of class_type)
                    if (node.inputs && typeof node.inputs === 'object') {
                        // Extract model
                        if (node.inputs.unet_name && !ai.model) ai.model = node.inputs.unet_name;
                        if (node.inputs.ckpt_name && !ai.model) ai.model = node.inputs.ckpt_name;
                        
                        // Extract sampler settings (if this node has them)
                        if (node.inputs.sampler_name) {
                            ai.sampler = node.inputs.sampler_name;
                            ai.steps = node.inputs.steps || ai.steps;
                            ai.cfgScale = node.inputs.cfg || ai.cfgScale;
                            ai.seed = node.inputs.seed || ai.seed;
                        }
                        
                        // Extract LoRA
                        if (node.inputs.lora_name) {
                            if (!ai.loras.includes(node.inputs.lora_name)) {
                                ai.loras.push(node.inputs.lora_name);
                            }
                        }
                        
                        // Extract text from positive/negative inputs
                        if (typeof node.inputs.text === 'string' && node.inputs.text.length > 5) {
                            const isNegative = node.inputs.text.toLowerCase().includes('blurry') || 
                                              node.inputs.text.toLowerCase().includes('ugly') ||
                                              node.inputs.text.toLowerCase().includes('bad');
                            
                            if (isNegative && !ai.negativePrompt) {
                                ai.negativePrompt = node.inputs.text;
                            } else if (!isNegative && !promptFromNodes) {
                                promptFromNodes = node.inputs.text;
                            }
                        }
                    }
                    
                    // Also check old method with class_type for compatibility
                    if (node.class_type) {
                        if ((node.class_type === 'UNETLoader' || node.class_type === 'CheckpointLoaderSimple') && node.inputs) {
                            if (node.inputs.unet_name) ai.model = node.inputs.unet_name;
                            if (node.inputs.ckpt_name) ai.model = node.inputs.ckpt_name;
                        }
                        
                        if (node.class_type === 'KSampler' && node.inputs) {
                            ai.sampler = node.inputs.sampler_name || ai.sampler;
                            ai.steps = node.inputs.steps || ai.steps;
                            ai.cfgScale = node.inputs.cfg || ai.cfgScale;
                            ai.seed = node.inputs.seed || ai.seed;
                        }
                        
                        if (node.class_type === 'LoraLoader' && node.inputs && node.inputs.lora_name) {
                            if (!ai.loras.includes(node.inputs.lora_name)) {
                                ai.loras.push(node.inputs.lora_name);
                            }
                        }
                    }
                    
                    // Extract prompts from text encoding nodes (backup if no text chunk)
                    if (node.class_type === 'CLIPTextEncode' && node.inputs && node.inputs.text) {
                        const nodeText = node.inputs.text;
                        if (typeof nodeText === 'string' && nodeText.length > 5) {
                            // Check if this looks like a negative prompt
                            const isNegative = nodeText.toLowerCase().includes('blurry') || 
                                              nodeText.toLowerCase().includes('ugly') ||
                                              nodeText.toLowerCase().includes('bad quality');
                            
                            if (isNegative) {
                                if (!ai.negativePrompt) ai.negativePrompt = nodeText;
                            } else {
                                // This is a positive prompt - save as backup
                                if (!promptFromNodes) promptFromNodes = nodeText;
                            }
                        }
                    }
                }
            }
        }
        
        // Prioritize prompts: original text chunk (with wildcards) > prompt from nodes
        ai.prompt = originalPrompt || promptFromNodes;
        
        // Detect wildcards in prompt
        if (ai.prompt) {
            const wildcardPattern = /__.*?__/g;
            const matches = ai.prompt.match(wildcardPattern);
            if (matches) {
                ai.wildcards = matches;
            }
        }
    }
    
    return ai;
}

// Determine image provenance
function determineProvenance(metadata) {
    const hasCamera = metadata.exif && (
        metadata.exif.Make || metadata.exif.Model || 
        metadata.exif.LensModel || metadata.exif.LensMake
    );
    
    const hasAI = metadata.aiMetadata && (
        metadata.aiMetadata.hasComfyUI || 
        metadata.aiMetadata.hasStableDiffusion ||
        metadata.aiMetadata.model
    );
    
    if (hasCamera && !hasAI) return 'camera';
    if (hasAI && !hasCamera) return 'ai';
    if (hasCamera && hasAI) return 'mixed';
    return 'unclear';
}

function getContainerType(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const types = {
        'jpg': 'JPEG', 'jpeg': 'JPEG', 'png': 'PNG',
        'gif': 'GIF', 'tiff': 'TIFF', 'tif': 'TIFF',
        'heic': 'HEIC', 'webp': 'WebP'
    };
    return types[ext] || 'Unknown';
}

// Extract wildcards and their resolutions
function extractWildcards(originalPrompt, resolvedPrompt) {
    if (!originalPrompt || !resolvedPrompt) return [];
    
    const wildcards = [];
    const wildcardPattern = /__.*?__/g;
    const matches = [];
    let match;
    
    // Reset regex lastIndex
    wildcardPattern.lastIndex = 0;
    
    // Find all wildcard patterns
    while ((match = wildcardPattern.exec(originalPrompt)) !== null) {
        matches.push({
            pattern: match[0],
            index: match.index
        });
    }
    
    if (matches.length === 0) return [];
    
    // For each wildcard, find its resolved value
    for (let i = 0; i < matches.length; i++) {
        const wildcard = matches[i];
        const beforeWildcard = originalPrompt.substring(0, wildcard.index);
        const nextWildcard = matches[i + 1];
        const afterWildcard = nextWildcard ? 
            originalPrompt.substring(wildcard.index + wildcard.pattern.length, nextWildcard.index) :
            originalPrompt.substring(wildcard.index + wildcard.pattern.length);
        
        // Find corresponding text in resolved prompt
        const beforeIndex = resolvedPrompt.indexOf(beforeWildcard);
        if (beforeIndex > -1) {
            const searchStart = beforeIndex + beforeWildcard.length;
            const afterIndex = afterWildcard ? resolvedPrompt.indexOf(afterWildcard, searchStart) : resolvedPrompt.length;
            
            if (afterIndex > -1) {
                const resolvedValue = resolvedPrompt.substring(searchStart, afterIndex).trim();
                if (resolvedValue && resolvedValue !== wildcard.pattern) {
                    wildcards.push({
                        name: wildcard.pattern,
                        resolved: resolvedValue
                    });
                }
            }
        }
    }
    
    return wildcards;
}

// Toggle expandable rows
function toggleRow(element) {
    const nestedRow = element.nextElementSibling;
    const toggle = element.querySelector('.toggle');
    
    if (nestedRow && nestedRow.classList.contains('nested')) {
        if (nestedRow.style.display === 'none') {
            nestedRow.style.display = 'table-row';
            toggle.textContent = '-';
        } else {
            nestedRow.style.display = 'none';
            toggle.textContent = '+';
        }
    }
}

// Toggle section collapse/expand (mobile feature)
function toggleSection(element) {
    // Only work on mobile (768px and below)
    if (window.innerWidth > 768) return;
    
    const section = element.closest('.metadata-section');
    const content = section.querySelector('.section-content');
    const icon = element.querySelector('.section-collapse-icon');
    
    if (content) {
        content.classList.toggle('collapsed');
        if (icon) {
            icon.textContent = content.classList.contains('collapsed') ? '▼' : '▲';
        }
    }
}

// Helper to create section wrapper with collapse functionality
function createSectionHTML(title, content, categoryClass = '', sectionId = '') {
    const idAttr = sectionId ? ` id="${sectionId}"` : '';
    const titleClass = categoryClass ? `section-title ${categoryClass}` : 'section-title';
    
    let html = `<div class="metadata-section"${idAttr}>`;
    html += `<div class="${titleClass}" onclick="toggleSection(this)">`;
    html += `<span>${title}</span>`;
    html += `<span class="section-collapse-icon">▲</span>`;
    html += `</div>`;
    html += `<div class="section-content">${content}</div>`;
    html += `</div>`;
    return html;
}

// Format wildcard name for display (shorten for mobile)
function formatWildcardName(name) {
    // Remove common prefixes to save space
    let formatted = name;
    
    // Remove __mklinkwildcards/ prefix if present
    if (formatted.startsWith('__mklinkwildcards/')) {
        formatted = formatted.substring('__mklinkwildcards/'.length);
    }
    
    // Remove leading/trailing underscores (common in wildcard naming)
    formatted = formatted.replace(/^_+|_+$/g, '');
    
    // If still very long (>30 chars), truncate with ellipsis
    if (formatted.length > 30) {
        formatted = formatted.substring(0, 27) + '...';
    }
    
    return formatted;
}

// Create metadata table with expandable rows
function createMetadataTableHTML(metadata, sectionType = '') {
    const sectionClass = sectionType ? `table-${sectionType}` : '';
    let html = `<table class="metadata-table ${sectionClass}"><tbody>`;
    
    function formatValue(value, key = '') {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value.toString();
        if (typeof value === 'number') return value.toLocaleString();
        if (typeof value === 'string') {
            // Unescape Unicode sequences then escape HTML
            const unescaped = unescapeUnicode(value);
            const escaped = escapeHtml(unescaped);
            
            // Add copy button for long text (>100 chars) or specific keys
            const needsCopyButton = unescaped.length > 100 || 
                key.toLowerCase().includes('prompt') || 
                key.toLowerCase().includes('text');
            
            if (needsCopyButton) {
                const encoded = btoa(unescape(encodeURIComponent(unescaped)));
                return `${escaped}<br><span class="copy-text-btn" data-text-encoded="${encoded}" style="cursor:pointer; color:#6FC3DF; font-size:10px;">[ Copy ]</span>`;
            }
            
            return escaped;
        }
        if (Array.isArray(value)) {
            // Check if it's an array of primitives
            if (value.length === 0) return '[Empty Array]';
            if (typeof value[0] !== 'object') {
                return escapeHtml(value.map(v => typeof v === 'string' ? unescapeUnicode(v) : v).join(', '));
            }
            return `[Array: ${value.length} items]`;
        }
        return escapeHtml(String(value));
    }
    
    function addRows(obj, prefix = '', depth = 0) {
        if (depth > 3) return; // Limit nesting depth
        
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                // Array of objects - create expandable row
                html += `<tr class="expandable" onclick="toggleRow(this)" style="cursor: pointer;">`;
                html += `<td>${escapeHtml(fullKey)}</td>`;
                html += `<td>[Array: ${value.length} items] <span class="toggle">+</span></td>`;
                html += `</tr>`;
                html += `<tr class="nested" style="display:none;">`;
                html += `<td colspan="2" style="padding-left:20px; padding-top:0; padding-bottom:0;">`;
                html += `<table style="width:100%; margin:0; border-collapse:collapse; font-size:12px;">`;
                
                // Add array items
                value.forEach((item, index) => {
                    if (typeof item === 'object' && item !== null) {
                        const itemKeys = Object.keys(item);
                        html += `<tr class="expandable" onclick="toggleRow(this)" style="cursor: pointer;">`;
                        html += `<td>[${index}]</td>`;
                        html += `<td>[Object: ${itemKeys.length} properties] <span class="toggle">+</span></td>`;
                        html += `</tr>`;
                        html += `<tr class="nested" style="display:none;">`;
                        html += `<td colspan="2" style="padding-left:15px;">`;
                        html += `<table style="width:100%; margin:0; border-collapse:collapse; font-size:11px;">`;
                        
                        for (const [itemKey, itemValue] of Object.entries(item)) {
                            html += `<tr><td>${escapeHtml(itemKey)}</td><td>${formatValue(itemValue, itemKey)}</td></tr>`;
                        }
                        
                        html += `</table></td></tr>`;
                    } else {
                        html += `<tr><td>[${index}]</td><td>${formatValue(item, `[${index}]`)}</td></tr>`;
                    }
                });
                
                html += `</table></td></tr>`;
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Nested object - create expandable row
                const itemCount = Object.keys(value).length;
                const isExif = key === 'exif' || key.toLowerCase() === 'exif';
                
                if (isExif) {
                    // EXIF expanded by default
                    html += `<tr class="expandable" onclick="toggleRow(this)" style="cursor: pointer;">`;
                    html += `<td>${escapeHtml(fullKey)}</td>`;
                    html += `<td>[Object: ${itemCount} properties] <span class="toggle">-</span></td>`;
                    html += `</tr>`;
                    html += `<tr class="nested" style="display:table-row;">`;
                } else {
                    // Other objects collapsed by default
                    html += `<tr class="expandable" onclick="toggleRow(this)" style="cursor: pointer;">`;
                    html += `<td>${escapeHtml(fullKey)}</td>`;
                    html += `<td>[Object: ${itemCount} properties] <span class="toggle">+</span></td>`;
                    html += `</tr>`;
                    html += `<tr class="nested" style="display:none;">`;
                }
                
                html += `<td colspan="2" style="padding-left:20px; padding-top:0; padding-bottom:0;">`;
                html += `<table style="width:100%; margin:0; border-collapse:collapse; font-size:12px;">`;
                
                // Add nested properties
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    const displayKey = nestedKey.replace(/^(EXIF|GPS|Image|Interoperability)\s+/i, '');
                    
                    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue) && depth < 2) {
                        // Another level of nesting
                        const nestedItemCount = Object.keys(nestedValue).length;
                        html += `<tr class="expandable" onclick="toggleRow(this)" style="cursor: pointer;">`;
                        html += `<td>${escapeHtml(displayKey)}</td>`;
                        html += `<td>[Object: ${nestedItemCount} properties] <span class="toggle">+</span></td>`;
                        html += `</tr>`;
                        html += `<tr class="nested" style="display:none;">`;
                        html += `<td colspan="2" style="padding-left:15px;">`;
                        html += `<table style="width:100%; margin:0; border-collapse:collapse; font-size:11px;">`;
                        
                        for (const [deepKey, deepValue] of Object.entries(nestedValue)) {
                            html += `<tr><td>${escapeHtml(deepKey)}</td><td>${formatValue(deepValue, deepKey)}</td></tr>`;
                        }
                        
                        html += `</table></td></tr>`;
                    } else {
                        html += `<tr><td>${escapeHtml(displayKey)}</td><td>${formatValue(nestedValue, displayKey)}</td></tr>`;
                    }
                }
                
                html += `</table></td></tr>`;
            } else {
                // Simple value (including simple arrays)
                html += `<tr><td>${escapeHtml(fullKey)}</td><td>${formatValue(value, fullKey)}</td></tr>`;
            }
        }
    }
    
    addRows(metadata);
    html += '</tbody></table>';
    return html;
}

// Display metadata in terminal
function displayMetadata(metadata) {
    resetParsingFlowView();
    let html = `<div class="output-line success flow-status-line">
        <span>Metadata extracted successfully</span>
        <span class="flow-status-actions">
            <span class="copy-text-btn" id="parsingFlowBack" onclick="toggleParsingFlow()" style="cursor:pointer; color:#6FC3DF; display: none;">[ Back to Metadata ]</span>
            <span class="copy-text-btn" onclick="exportJSON()" style="cursor:pointer; color:#6FC3DF;">[ Export JSON ]</span>
            <span class="copy-text-btn" id="parsingFlowToggle" onclick="toggleParsingFlow()" style="cursor:pointer; color:#6FC3DF;">[ Parsing Flow ]</span>
        </span>
    </div>`;
    html += '<div id="metadataBody">';
    
    // Summary section (merged Smart Summary + regular Summary)
    html += '<div class="metadata-section"><div class="section-title category-structure">Summary</div>';
    html += '<table class="metadata-table"><tbody>';
    
    // Always show these core fields first
    html += `<tr><td>fileName</td><td>${escapeHtml(metadata.fileName)}</td></tr>`;
    html += `<tr><td>containerType</td><td><span style="color: #FF6AC1; font-weight: bold;">${metadata.containerType}</span></td></tr>`;
    html += `<tr><td>fileSize (MB)</td><td><span style="color: #FF6AC1; font-weight: bold;">${(metadata.fileSize / 1024 / 1024).toFixed(2)}</span></td></tr>`;
    
    // Flatten EXIF data for easier access
    let allExifData = {};
    if (metadata.exif) {
        allExifData = { ...metadata.exif };
        if (metadata.exif.ifd0) Object.assign(allExifData, metadata.exif.ifd0);
        if (metadata.exif.exif) Object.assign(allExifData, metadata.exif.exif);
        if (metadata.exif.gps) Object.assign(allExifData, metadata.exif.gps);
    }
    
    // Dimensions - ALWAYS show
    let width = allExifData.ImageWidth || allExifData.PixelXDimension || allExifData['Image ImageWidth'] || null;
    let height = allExifData.ImageLength || allExifData.PixelYDimension || allExifData['Image ImageLength'] || null;
    
    if (width && height) {
        html += `<tr><td>Dimensions</td><td>${width} x ${height}</td></tr>`;
    }
    
    // Date Created - ALWAYS show if available
    if (metadata.exif) {
        // Check multiple date fields in order of preference
        let dateCreated = allExifData.DateTime || 
                         allExifData.DateTimeOriginal || 
                         allExifData.CreateDate ||
                         allExifData['306'] || // IFD0 DateTime tag
                         null;
        
        if (dateCreated) {
            // Format the date nicely
            let displayDate = dateCreated;
            if (dateCreated instanceof Date) {
                displayDate = dateCreated.toLocaleString();
            } else if (typeof dateCreated === 'string') {
                // Try to parse and format common EXIF date formats
                const dateMatch = dateCreated.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
                if (dateMatch) {
                    // Convert EXIF format (YYYY:MM:DD HH:MM:SS) to readable format
                    const [, year, month, day, hour, minute, second] = dateMatch;
                    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                    displayDate = date.toLocaleString();
                }
            }
            const displayDateText = String(displayDate);
            const yearMatch = displayDateText.match(/\b(\d{4})\b/);
            let safeDateText = escapeHtml(displayDateText);
            if (yearMatch) {
                const yearToken = escapeHtml(yearMatch[1]);
                safeDateText = safeDateText.replace(
                    yearToken,
                    `<span class="category-structure">${yearToken}</span>`
                );
            }
            html += `<tr><td>Date Created</td><td>${safeDateText}</td></tr>`;
        }
    }
    
    // Separator line
    html += `<tr><td colspan="2" style="border-top: 1px solid #30363d; padding-top: 8px;"></td></tr>`;
    
    // Adaptive content based on metadata type
    
    // Camera metadata - show if ANY camera data is found (not just if provenance is camera)
    if (metadata.exif) {
        
        // Camera Model (check multiple fields)
        const cameraModel = allExifData.Model || allExifData['272'] || null;
        const cameraMake = allExifData.Make || null;
        
        if (cameraModel || cameraMake) {
            const camera = [cameraMake, cameraModel].filter(Boolean).join(' ');
            html += `<tr><td>Camera</td><td><span style="color: #FFA657; font-weight: bold;">${escapeHtml(camera)}</span></td></tr>`;
        }
        
        // Lens Model (check EXIF tag 42036 and other fields)
        const lensModel = allExifData.LensModel || 
                         allExifData['42036'] || 
                         allExifData.LensInfo ||
                         null;
        
        if (lensModel) {
            html += `<tr><td>Lens</td><td>${escapeHtml(String(lensModel))}</td></tr>`;
        }
        
        // Only show detailed camera settings if we have camera data
        if (cameraModel || cameraMake || lensModel) {
            if (allExifData.FNumber) {
                html += `<tr><td>Aperture</td><td>f/${allExifData.FNumber}</td></tr>`;
            }
            if (allExifData.ExposureTime) {
                const exposure = allExifData.ExposureTime < 1 ? `1/${Math.round(1/allExifData.ExposureTime)}` : `${allExifData.ExposureTime}`;
                html += `<tr><td>Shutter Speed</td><td>${exposure}s</td></tr>`;
            }
            if (allExifData.ISO || allExifData.ISOSpeedRatings) {
                const iso = allExifData.ISO || allExifData.ISOSpeedRatings;
                html += `<tr><td>ISO</td><td>${iso}</td></tr>`;
            }
            if (allExifData.FocalLength) {
                html += `<tr><td>Focal Length</td><td>${allExifData.FocalLength}mm</td></tr>`;
            }
        }
    }
    
    // AI metadata
    if (metadata.aiMetadata && (metadata.aiMetadata.hasComfyUI || metadata.aiMetadata.hasStableDiffusion)) {
        if (metadata.aiMetadata.model) {
            html += `<tr><td>AI Model</td><td><span style="color: #7EE787; font-weight: bold;">${escapeHtml(metadata.aiMetadata.model)}</span></td></tr>`;
        }
        if (metadata.aiMetadata.resolvedPrompt) {
            const resolvedShort = unescapeUnicode(metadata.aiMetadata.resolvedPrompt);
            const preview = resolvedShort.length > 150 ? resolvedShort.substring(0, 150) + '...' : resolvedShort;
            html += `<tr><td>Generated Image</td><td><span style="color: #7EE787;">${escapeHtml(preview)}</span></td></tr>`;
        } else if (metadata.aiMetadata.prompt) {
            const promptShort = unescapeUnicode(metadata.aiMetadata.prompt);
            const preview = promptShort.length > 150 ? promptShort.substring(0, 150) + '...' : promptShort;
            html += `<tr><td>Prompt</td><td><span style="color: #7EE787;">${escapeHtml(preview)}</span></td></tr>`;
        }
    }
    
    // GPS metadata
    if (metadata.gps && metadata.gps.formatted) {
        const gpsId = `gps-copy-${Date.now()}`;
        html += `<tr><td>GPS Coordinates</td><td>`;
        html += `<span style="color: #6FC3DF; font-weight: bold;">${escapeHtml(metadata.gps.formatted)}</span>`;
        html += `<span class="copy-icon" onclick="copyGPSCoords('${escapeHtml(metadata.gps.formatted)}', this)" id="${gpsId}" style="margin-left: 10px; cursor: pointer; color: #6FC3DF;" title="Click to copy coordinates">[ Copy ]</span>`;
        html += `</td></tr>`;
    }
    
    html += '</tbody></table></div>';
    
    // Data Recap section
    html += '<div class="metadata-section"><div class="section-title">Data Recap</div>';
    html += createDataRecap(metadata);
    html += '</div>';
    
    // ComfyUI Workflow section
    if (metadata.aiMetadata && metadata.aiMetadata.hasComfyUI) {
        html += '<div class="metadata-section" id="section-comfyui"><div class="section-title category-ai">ComfyUI Workflow</div>';
        html += '<table class="metadata-table"><tbody>';
        
        // Debug: Log what we have
        
        // Use data from metadata.aiMetadata (already extracted)
        const model = metadata.aiMetadata.model;
        const sampler = metadata.aiMetadata.sampler;
        const steps = metadata.aiMetadata.steps;
        const cfgScale = metadata.aiMetadata.cfgScale;
        const seed = metadata.aiMetadata.seed;
        const loras = metadata.aiMetadata.loras || [];
        
        // Display all fields directly (no collapsing)
        if (model) html += `<tr><td>Model</td><td>${escapeHtml(model)}</td></tr>`;
        if (loras.length > 0) html += `<tr><td>LoRA</td><td>${escapeHtml(loras.join(', '))}</td></tr>`;
        if (sampler) html += `<tr><td>Sampler</td><td class="category-ai">${escapeHtml(sampler)}</td></tr>`;
        if (steps) html += `<tr><td>Steps</td><td class="category-ai">${steps}</td></tr>`;
        if (cfgScale) html += `<tr><td>CFG Scale</td><td>${cfgScale}</td></tr>`;
        if (seed) html += `<tr><td>Seed</td><td>${seed}</td></tr>`;
        
        // Display prompt with copy button - HIGHLIGHTED IN GREEN
        if (metadata.aiMetadata.prompt) {
            const promptText = unescapeUnicode(metadata.aiMetadata.prompt);
            const promptEncoded = btoa(unescape(encodeURIComponent(promptText)));
            html += `<tr><td>Prompt</td><td><span style="color: #7EE787;">${escapeHtml(promptText)}</span><br><span class="copy-text-btn" data-text-encoded="${promptEncoded}" style="cursor:pointer; color:#6FC3DF; font-size:10px;">[ Copy ]</span></td></tr>`;
        }
        
        // Count wildcards
        const wildcardCount = metadata.aiMetadata.wildcards ? metadata.aiMetadata.wildcards.length : 0;
        html += `<tr><td>Wildcards Used</td><td>${wildcardCount}</td></tr>`;
        
        const resolvedPrompt = metadata.aiMetadata.resolvedPrompt;
        html += `<tr><td>Wildcard result</td><td>${resolvedPrompt ? 'resolution saved' : 'resolution not saved'}</td></tr>`;
        
        // Display resolved prompt if available - HIGHLIGHTED IN GREEN
        if (resolvedPrompt) {
            const resolvedText = unescapeUnicode(resolvedPrompt);
            const resolvedEncoded = btoa(unescape(encodeURIComponent(resolvedText)));
            html += `<tr><td>Resolved Prompt</td><td><span style="color: #7EE787;">${escapeHtml(resolvedText)}</span><br><span class="copy-text-btn" data-text-encoded="${resolvedEncoded}" style="cursor:pointer; color:#6FC3DF; font-size:10px;">[ Copy ]</span></td></tr>`;
            
            // Extract and display wildcard resolutions
            if (metadata.aiMetadata.prompt && wildcardCount > 0) {
                const wildcards = extractWildcards(metadata.aiMetadata.prompt, resolvedPrompt);
                if (wildcards.length > 0) {
                    html += `<tr><td colspan="2" style="padding-top: 10px; font-weight: bold; color: #6FC3DF;">Wildcard Resolutions</td></tr>`;
                    for (const wc of wildcards) {
                        const wcResolved = unescapeUnicode(wc.resolved);
                        const shortName = formatWildcardName(wc.name);
                        html += `<tr><td style="padding-left: 20px;" title="${escapeHtml(wc.name)}">${escapeHtml(shortName)}</td><td>${escapeHtml(wcResolved)}</td></tr>`;
                    }
                }
            }
        }
        
        // Display negative prompt if available
        if (metadata.aiMetadata.negativePrompt) {
            const negPromptText = unescapeUnicode(metadata.aiMetadata.negativePrompt);
            const negPromptEncoded = btoa(unescape(encodeURIComponent(negPromptText)));
            html += `<tr><td>Negative Prompt</td><td>${escapeHtml(negPromptText)}<br><span class="copy-text-btn" data-text-encoded="${negPromptEncoded}" style="cursor:pointer; color:#6FC3DF; font-size:10px;">[ Copy ]</span></td></tr>`;
        }
        
        // Display nodes count if available
        if (metadata.aiMetadata.workflow) {
            const nodes = metadata.aiMetadata.workflow.nodes || metadata.aiMetadata.workflow;
            const nodeCount = Object.keys(nodes).length;
            html += `<tr><td>Nodes</td><td>${nodeCount} nodes</td></tr>`;
        }
        
        html += '</tbody></table></div>';
    }
    
    // Encryption and AI section (for non-ComfyUI AI metadata)
    if (metadata.aiMetadata && !metadata.aiMetadata.hasComfyUI && (metadata.aiMetadata.model || metadata.aiMetadata.prompt)) {
        html += '<div class="metadata-section" id="section-ai"><div class="section-title category-ai">Encryption and AI</div>';
        
        const aiData = {};
        if (metadata.aiMetadata.model) aiData.Model = metadata.aiMetadata.model;
        if (metadata.aiMetadata.prompt) aiData.Prompt = metadata.aiMetadata.prompt;
        if (metadata.aiMetadata.sampler) aiData.Sampler = metadata.aiMetadata.sampler;
        if (metadata.aiMetadata.steps) aiData.Steps = metadata.aiMetadata.steps;
        if (metadata.aiMetadata.seed) aiData.Seed = metadata.aiMetadata.seed;
        
        html += createMetadataTableHTML(aiData, 'ai');
        html += '</div>';
    }
    
    // Structure section - MOVED DOWN
    if (metadata.structure) {
        html += '<div class="metadata-section" id="section-structure"><div class="section-title category-structure">Structure</div>';
        html += createMetadataTableHTML(metadata.structure, 'structure');
        html += '</div>';
    }
    
    // Declared Metadata (EXIF) section - MOVED DOWN
    if (metadata.exif && Object.keys(metadata.exif).length > 0) {
        html += '<div class="metadata-section" id="section-metadata"><div class="section-title category-metadata">Declared Metadata</div>';
        html += createMetadataTableHTML({ exif: metadata.exif }, 'metadata');
        html += '</div>';
    }
    
    // Anomalies section
    if (metadata.anomalies) {
        html += '<div class="metadata-section" id="section-anomalies"><div class="section-title category-anomaly">Anomalies</div>';
        html += createMetadataTableHTML(metadata.anomalies, 'anomaly');
        html += '</div>';
    }
    
    // Bottom raw data display
    html += '<div class="metadata-section" id="section-full-object"><div class="section-title">Full Object Display</div>';
    html += '<p class="info" style="margin-bottom: 10px;">All extracted data in structured format:</p>';
    html += createMetadataTableHTML({
        summary: metadata.fileName ? { fileName: metadata.fileName, fileSize: metadata.fileSize, containerType: metadata.containerType } : null,
        structure: metadata.structure,
        metadata: metadata.exif ? { exif: metadata.exif } : null,
        aiMetadata: metadata.aiMetadata,
        anomalies: metadata.anomalies,
        provenance: metadata.provenance
    }, 'payload');
    html += '</div>';
    
    // File Structure Visualization (Chunks) - at the very bottom
    html += '<div class="metadata-section" id="section-structure-viz" style="margin-top: 20px;"><div class="section-title category-structure">File Structure Visualization</div>';
    html += '<div id="chunksVisualizationInline"></div>';
    html += '</div>';
    
    output.innerHTML = html;
    
    // Populate chunks visualization if available
    if (metadata.chunks && currentFile) {
        updateChunksVisualization(metadata.chunks, currentFile);
    }
}

// Create Data Recap section
function createDataRecap(metadata) {
    const textChunks = metadata.pngTextChunks || [];
    const exifKeys = [];
    const exifValues = {};

    const collectExif = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = String(key).toLowerCase();
            exifKeys.push(lowerKey);
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                collectExif(value);
            } else if (value !== undefined && value !== null && String(value).trim() !== '') {
                exifValues[lowerKey] = value;
            }
        }
    };

    collectExif(metadata.exif);

    const allExifData = (() => {
        const combined = {};
        if (metadata.exif) {
            Object.assign(combined, metadata.exif);
            if (metadata.exif.ifd0) Object.assign(combined, metadata.exif.ifd0);
            if (metadata.exif.exif) Object.assign(combined, metadata.exif.exif);
            if (metadata.exif.gps) Object.assign(combined, metadata.exif.gps);
        }
        return combined;
    })();

    const cameraModel = allExifData.Model || allExifData['272'] || null;
    const cameraMake = allExifData.Make || null;
    const lensModel = allExifData.LensModel || allExifData['42036'] || allExifData.LensInfo || null;

    const hasKey = (...terms) => {
        return terms.some(term => exifKeys.some(key => key.includes(term)));
    };

    const hasValueFor = (...terms) => {
        return terms.some(term => {
            return Object.entries(exifValues).some(([key, value]) => {
                return key.includes(term) && String(value).trim() !== '';
            });
        });
    };

    const isJsonText = (text) => {
        if (!text || typeof text !== 'string') return false;
        try {
            JSON.parse(text);
            return true;
        } catch (e) {
            return false;
        }
    };

    const hasJsonTextChunk = textChunks.some(chunk => isJsonText(chunk.text));
    const hasPromptTextChunk = textChunks.some(chunk => {
        const keyLower = (chunk.keyword || '').toLowerCase();
        return keyLower.includes('prompt') && !isJsonText(chunk.text);
    });
    const hasWorkflowJson = metadata.aiMetadata?.hasComfyUI || textChunks.some(chunk => {
        return isJsonText(chunk.text) && /"nodes"|\"workflow\"/i.test(chunk.text);
    });
    const hasLoraJson = (metadata.aiMetadata?.loras && metadata.aiMetadata.loras.length > 0) || textChunks.some(chunk => {
        return isJsonText(chunk.text) && /lora/i.test(chunk.text);
    });
    const hasControlNetJson = textChunks.some(chunk => {
        return isJsonText(chunk.text) && /controlnet|control_net/i.test(chunk.text);
    });
    const hasA1111Json = textChunks.some(chunk => {
        return isJsonText(chunk.text) && /\"prompt\"|\"negative_prompt\"/i.test(chunk.text);
    });
    const hasUpscaleJson = textChunks.some(chunk => {
        return isJsonText(chunk.text) && /upscale|scale/i.test(chunk.text);
    });
    const hasSeedHistoryJson = textChunks.some(chunk => {
        return isJsonText(chunk.text) && /seed|history/i.test(chunk.text);
    });
    const hasYamlLike = textChunks.some(chunk => {
        return /yaml:|training|trained/i.test(chunk.text || '');
    });
    const hasCheckpointJson = textChunks.some(chunk => {
        return isJsonText(chunk.text) && /checkpoint|model_name/i.test(chunk.text);
    });

    const aiSection = metadata.aiMetadata?.hasComfyUI
        ? 'section-comfyui'
        : (metadata.aiMetadata && (metadata.aiMetadata.model || metadata.aiMetadata.prompt) ? 'section-ai' : 'section-full-object');

    const hasJpegAppMarkers = Array.isArray(metadata.chunks) && metadata.chunks.some(segment => {
        if (!segment || !segment.type) return false;
        const typeHex = typeof segment.type === 'string' ? segment.type.toLowerCase() : '';
        if (segment.typeName && segment.typeName.startsWith('APP')) return true;
        const marker = parseInt(typeHex.replace('0x', ''), 16);
        return marker >= 0xFFE0 && marker <= 0xFFEF;
    });

    const hasPngTextChunks = (Array.isArray(metadata.chunks) && metadata.chunks.some(c => ['tEXt', 'zTXt', 'iTXt'].includes(c.type))) || textChunks.length > 0;
    const hasPngtEXtChunks = Array.isArray(metadata.chunks) && metadata.chunks.some(c => c.type === 'tEXt');

    const checks = [
        { name: 'Camera data', found: Boolean(cameraMake || cameraModel) || hasValueFor('make', 'model') || hasKey('make', 'model'), section: 'section-metadata' },
        { name: 'Lens data', found: Boolean(lensModel) || hasValueFor('lensmodel', 'lens info', 'lensinfo', 'lens') || hasKey('lens'), section: 'section-metadata' },
        { name: 'EXIF', found: metadata.exif && Object.keys(metadata.exif).length > 0, section: 'section-metadata' },
        { name: 'IPTC', found: metadata.exif?.iptc || hasKey('iptc'), section: 'section-metadata' },
        { name: 'XMP', found: metadata.exif?.xmp || hasKey('xmp'), section: 'section-metadata' },
        { name: 'ICC profiles', found: metadata.exif?.icc || hasKey('icc'), section: 'section-metadata' },
        { name: 'GPS', found: metadata.gps || metadata.exif?.gps || hasKey('gps'), section: 'section-metadata' },
        { name: 'TIFF tags', found: metadata.exif?.tiff || hasKey('tiff'), section: 'section-metadata' },
        { name: 'JPEG APP markers', found: hasJpegAppMarkers, section: 'section-structure-viz' },
        { name: 'PNG text chunks', found: hasPngTextChunks, section: 'section-structure-viz' },
        { name: 'Photoshop IRB', found: hasKey('photoshop', 'irb'), section: 'section-metadata' },
        { name: 'MakerNote', found: hasKey('makernote', 'maker note'), section: 'section-metadata' },
        { name: 'Thumbnail data', found: hasKey('thumbnail'), section: 'section-metadata' },
        { name: 'IFD (Image File Directory)', found: hasKey('ifd'), section: 'section-metadata' },
        { name: 'DNG raw metadata', found: hasKey('dng'), section: 'section-metadata' },
        { name: 'Rights management', found: hasKey('copyright', 'rights'), section: 'section-metadata' },
        { name: 'Descriptive keywords', found: hasKey('keyword', 'subject'), section: 'section-metadata' },
        { name: 'Administrative data', found: hasKey('author', 'creator', 'artist'), section: 'section-metadata' },
        { name: 'TechSpecs (ISO,etc.)', found: hasKey('iso', 'fnumber', 'exposure', 'shutter', 'aperture'), section: 'section-metadata' },
        { name: 'PGP signature', found: false, section: 'section-full-object' },
        { name: 'ComfyUI workflow JSON', found: hasWorkflowJson, section: aiSection },
        { name: 'Prompt text files (.txt)', found: hasPromptTextChunk, section: aiSection },
        { name: 'LoRA config JSON', found: hasLoraJson, section: aiSection },
        { name: 'Model training YAML', found: hasYamlLike, section: aiSection },
        { name: 'Checkpoint info JSON', found: hasCheckpointJson, section: aiSection },
        { name: 'YAML prompt templates', found: hasYamlLike, section: aiSection },
        { name: 'ControlNet JSON', found: hasControlNetJson, section: aiSection },
        { name: 'A1111 .json prompts', found: hasA1111Json, section: aiSection },
        { name: 'Metadata JSON embeds', found: hasJsonTextChunk, section: aiSection },
        { name: 'Custom node configs YAML', found: hasYamlLike, section: aiSection },
        { name: 'BatchGen logs TXT', found: false, section: aiSection },
        { name: 'Upscale settings JSON', found: hasUpscaleJson, section: aiSection },
        { name: 'Seed/history JSON', found: hasSeedHistoryJson, section: aiSection },
        { name: 'AI metadata', found: metadata.aiMetadata?.hasComfyUI || metadata.aiMetadata?.hasStableDiffusion, section: aiSection },
        { name: 'Wildcards', found: metadata.aiMetadata?.wildcards && metadata.aiMetadata.wildcards.length > 0, section: aiSection },
        { name: 'Resolved prompt', found: metadata.aiMetadata?.resolvedPrompt, section: aiSection },
        { name: 'Structure data', found: metadata.structure, section: 'section-structure' },
        { name: 'Anomalies', found: metadata.anomalies && metadata.anomalies.flags && metadata.anomalies.flags.length > 0, section: 'section-anomalies' }
    ];
    
    let html = '<div class="data-recap">';
    
    for (const check of checks) {
        if (check.found) {
            if (check.section) {
                html += `<span class="recap-item">${escapeHtml(check.name)}: <span class="found" onclick="scrollToSection('${check.section}')" title="Click to jump to section">found</span></span> `;
            } else {
                html += `<span class="recap-item">${escapeHtml(check.name)}: <span class="found">found</span></span> `;
            }
        } else {
            html += `<span class="recap-item">${escapeHtml(check.name)}: <span class="not-found">not found</span></span> `;
        }
    }
    
    html += '</div>';
    return html;
}

// Scroll to section with highlight
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        section.classList.add('section-highlight');
        setTimeout(() => {
            section.classList.remove('section-highlight');
        }, 2000);
    }
}

// Chunks visualization
function updateChunksVisualization(chunks, file) {
    if (!chunks || chunks.length === 0) return;
    
    // Update inline visualization in metadata tab
    const container = document.getElementById('chunksVisualizationInline');
    let html = '';
    
    // Heatmap
    html += '<div class="heatmap-container">';
    html += '<h3>File Structure Heatmap</h3>';
    html += '<div class="heatmap">';
    
    const colors = {
        'IHDR': '#FF6AC1', 'IDAT': '#6FC3DF', 'IEND': '#3fb950',
        'tEXt': '#7EE787', 'iTXt': '#7EE787', 'zTXt': '#7EE787',
        'gAMA': '#FFA657', 'cHRM': '#FFA657', 'sRGB': '#FFA657',
        'iCCP': '#F778BA', 'pHYs': '#8b949e',
    };
    
    for (const chunk of chunks) {
        const color = colors[chunk.type] || '#30363d';
        const percent = (chunk.length / file.size * 100).toFixed(2);
        html += `<div class="heatmap-segment" style="width: ${percent}%; background: ${color};" title="${chunk.type}: ${chunk.length} bytes"></div>`;
    }
    
    html += '</div>';
    
    // Legend
    html += '<div class="chunk-legend">';
    const usedTypes = [...new Set(chunks.map(c => c.type))];
    for (const type of usedTypes) {
        const color = colors[type] || '#30363d';
        html += `<div class="legend-item"><div class="legend-color" style="background: ${color};"></div>${type}</div>`;
    }
    html += '</div></div>';
    
    // Chunk list (collapsible)
    html += '<div class="chunk-list">';
    html += '<h3 class="expandable" onclick="toggleRow(this)" style="cursor: pointer; display: flex; align-items: center; gap: 10px;">';
    html += '<span class="toggle">+</span> Chunk Details';
    html += '</h3>';
    html += '<div class="nested" style="display: none;">';
    chunks.forEach((chunk, i) => {
        html += `<div class="chunk-item">`;
        html += `<strong>${i + 1}.</strong> `;
        html += `Type: <span class="chunk-type-label">${chunk.type}</span> | `;
        html += `Length: ${chunk.length.toLocaleString()} bytes | `;
        html += `Offset: 0x${chunk.offset.toString(16).toUpperCase()}`;
        html += `</div>`;
    });
    html += '</div></div>';
    
    container.innerHTML = html;
}

// Export JSON
function exportJSON() {
    if (!currentMetadata) {
        alert('No metadata to export. Please analyze a file first.');
        return;
    }
    
    const fileName = currentFile.name.replace(/\.[^/.]+$/, "");
    const containerType = currentMetadata.containerType.toLowerCase();
    const exportName = `${fileName}_${containerType}_metadata.json`;
    
    const blob = new Blob([JSON.stringify(currentMetadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportName;
    a.click();
    URL.revokeObjectURL(url);
}

// Copy to clipboard
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = element.textContent;
        element.textContent = '[✓]';
        element.classList.add('copied');
        setTimeout(() => {
            element.textContent = originalText;
            element.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

// Copy GPS coordinates
function copyGPSCoords(coords, element) {
    navigator.clipboard.writeText(coords).then(() => {
        const originalText = element.textContent;
        element.textContent = '[ ✓ ]';
        element.style.color = '#3fb950';
        setTimeout(() => {
            element.textContent = originalText;
            element.style.color = '#6FC3DF';
        }, 2000);
    }).catch(err => {
        console.error('GPS copy failed:', err);
        alert('Failed to copy coordinates');
    });
}

// Copy button event delegation
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-text-btn')) {
        const encoded = e.target.getAttribute('data-text-encoded');
        if (encoded) {
            try {
                const text = decodeURIComponent(escape(atob(encoded)));
                copyToClipboard(text, e.target);
            } catch (err) {
                console.error('Failed to decode text:', err);
            }
        }
    }
});

// Utility functions
function escapeHtml(text) {
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function unescapeUnicode(text) {
    if (typeof text !== 'string') return text;
    // Decode Unicode escape sequences like \u00e8
    return text.replace(/\\u[\dA-F]{4}/gi, match => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
}

console.log('$ BareBlocks - Client-side metadata inspector ready');
console.log('All processing happens in your browser');
console.log('Files never leave your device');

