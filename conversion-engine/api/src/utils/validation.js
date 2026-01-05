const FileType = require('file-type');
const fs = require('fs').promises;
const path = require('path');

const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'webp', 'mp4', 'mkv', 'webm', 'mp3', 'wav',
    'flac', 'pdf', 'docx', 'gif', 'bmp', 'tiff', 'ico', 'avi', 'mov',
    'flv', '3gp', 'ts', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'xlsx',
    'pptx', 'html', 'txt'
];

// Dangerous file signatures (executables, scripts, etc.)
const DANGEROUS_SIGNATURES = [
    // Executables
    { ext: 'exe', mime: 'application/x-msdownload' },
    { ext: 'dll', mime: 'application/x-msdownload' },
    { ext: 'com', mime: 'application/x-msdownload' },
    { ext: 'bat', mime: 'application/x-bat' },
    { ext: 'cmd', mime: 'application/x-bat' },
    { ext: 'sh', mime: 'application/x-sh' },
    // Scripts
    { ext: 'js', mime: 'application/javascript' },
    { ext: 'vbs', mime: 'application/x-vbscript' },
    { ext: 'ps1', mime: 'application/x-powershell' },
    // Archives with executables (can contain malware)
    { ext: 'msi', mime: 'application/x-msi' },
];

// Maximum file size (5GB as per config)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || 5000) * 1024 * 1024;

/**
 * Validates a file using its buffer and reported extension.
 * Uses magic bytes (via file-type) for high-confidence validation.
 * SECURITY: Always requires magic byte verification, no bypass allowed
 */
async function validateFile(filePath, originalName) {
    try {
        // 1. Check file exists and get stats
        const stats = await fs.stat(filePath);

        // 2. File size validation
        if (stats.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File size ${(stats.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`
            };
        }

        if (stats.size === 0) {
            return { valid: false, error: 'File is empty (0 bytes)' };
        }

        // 3. Extension check
        const extFromPath = originalName.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(extFromPath)) {
            return {
                valid: false,
                error: `File type .${extFromPath} is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
            };
        }

        // 4. Read file buffer for magic byte check
        const buffer = await fs.readFile(filePath);
        const type = await FileType.fromBuffer(buffer);

        // 5. Check for dangerous file signatures
        if (type && DANGEROUS_SIGNATURES.some(sig => sig.ext === type.ext)) {
            return {
                valid: false,
                error: `File type ${type.ext} is not allowed for security reasons (executable/script detected)`
            };
        }

        // 6. Magic bytes validation
        if (!type) {
            // Only allow text-based formats without magic bytes
            const textFormats = ['txt', 'html', 'json', 'xml'];
            if (textFormats.includes(extFromPath)) {
                // Additional validation: check if content is actually text
                const isText = buffer.every(byte => byte < 128 || byte === 0x0A || byte === 0x0D);
                if (!isText) {
                    return {
                        valid: false,
                        error: 'File claims to be text but contains binary data (possible malware)'
                    };
                }
                return { valid: true, detectedType: 'text' };
            }

            // SECURITY FIX: No longer allow files without detectable signature
            return {
                valid: false,
                error: `Could not verify file signature for .${extFromPath} format. File may be corrupted or malicious.`
            };
        }

        // 7. Match detected type with extension
        const normalizedDetected = type.ext === 'jpg' ? 'jpeg' : type.ext;
        const normalizedExtension = extFromPath === 'jpg' ? 'jpeg' : extFromPath;

        if (normalizedDetected !== normalizedExtension) {
            // Special case: DOCX/XLSX/PPTX are ZIP files
            if (['docx', 'xlsx', 'pptx'].includes(normalizedExtension) && type.ext === 'zip') {
                return { valid: true, detectedType: type.ext };
            }

            // Special case: Some media files
            if (normalizedExtension === 'm4a' && type.ext === 'mp4') {
                return { valid: true, detectedType: type.ext };
            }

            return {
                valid: false,
                error: `File extension .${extFromPath} does not match detected content type (${type.ext}). Possible malware or file corruption.`
            };
        }

        return {
            valid: true,
            detectedType: type.ext,
            mimeType: type.mime,
            fileSize: stats.size
        };

    } catch (error) {
        return {
            valid: false,
            error: `Validation error: ${error.message}`
        };
    }
}

/**
 * Validates conversion format parameter
 * @param {string} format - Target format
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateFormat(format) {
    if (!format || typeof format !== 'string') {
        return { valid: false, error: 'Format parameter is required' };
    }

    const sanitized = format.toLowerCase().trim();

    if (!ALLOWED_EXTENSIONS.includes(sanitized)) {
        return {
            valid: false,
            error: `Invalid format "${format}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
        };
    }

    return { valid: true, format: sanitized };
}

/**
 * Validates preset parameter
 * @param {string} preset - Conversion preset
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validatePreset(preset) {
    const ALLOWED_PRESETS = ['quality', 'balanced', 'speed', 'web'];

    if (!preset) {
        return { valid: true, preset: 'balanced' }; // Default
    }

    if (typeof preset !== 'string') {
        return { valid: false, error: 'Preset must be a string' };
    }

    const sanitized = preset.toLowerCase().trim();

    if (!ALLOWED_PRESETS.includes(sanitized)) {
        return {
            valid: false,
            error: `Invalid preset "${preset}". Allowed: ${ALLOWED_PRESETS.join(', ')}`
        };
    }

    return { valid: true, preset: sanitized };
}

module.exports = {
    validateFile,
    validateFormat,
    validatePreset,
    ALLOWED_EXTENSIONS
};
