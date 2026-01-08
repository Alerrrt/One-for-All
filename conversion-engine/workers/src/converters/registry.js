/**
 * Converter Registry
 * Central registry for all converter modules
 * Inspired by ConvertX's main.ts converter mapping approach
 */

const converterRegistry = {
    // PHASE 1: New converters (High Priority)
    'dasel': require('./dasel'),
    'libheif': require('./libheif'),
    'inkscape': require('./inkscape'),
    'libreoffice': require('./libreoffice'),

    // REFACTORED: All legacy converters now modular
    'ffmpeg': require('./ffmpeg'),
    'imagemagick': require('./imagemagick'),
    'pandoc': require('./pandoc'),
};

/**
 * Get converter by name
 * @param {string} name - Converter name
 * @returns {Object} Converter instance
 */
function getConverter(name) {
    return converterRegistry[name];
}

/**
 * Find best converter for a given conversion
 * Priority order matches ConvertX's approach: specialized tools first
 * 
 * @param {string} inputFormat - Input file format (e.g., 'svg', 'heic')
 * @param {string} outputFormat - Output file format (e.g., 'png', 'jpg')
 * @returns {Object|null} First converter that supports this conversion, or null
 */
function findConverter(inputFormat, outputFormat) {
    // Priority order (specialized converters first)
    const priorityOrder = [
        'inkscape',     // Best for vector graphics (SVG, EPS, EMF)
        'libheif',      // Best for HEIC/HEIF
        'libreoffice',  // Best for office documents
        'dasel',        // Best for data interchange
        'ffmpeg',       // Media formats (video/audio)
        'imagemagick',  // General images
        'pandoc'        // Text/document conversion
    ];

    for (const converterName of priorityOrder) {
        const converter = converterRegistry[converterName];
        if (converter && converter.supports(inputFormat, outputFormat)) {
            return { name: converterName, converter };
        }
    }

    return null;
}

/**
 * Get all converters
 * @returns {Object} Converter registry
 */
function getAllConverters() {
    return converterRegistry;
}

/**
 * Get supported formats (for frontend/API)
 * @returns {Object} Format categories with supported extensions
 */
function getSupportedFormats() {
    const formats = {
        images: new Set(),
        documents: new Set(),
        data: new Set(),
        vector: new Set(),
        video: new Set(),
        audio: new Set()
    };

    // Aggregate formats from all converters
    for (const converterName in converterRegistry) {
        const converter = converterRegistry[converterName];
        const props = converter.properties;

        for (const category in props.from) {
            if (formats[category]) {
                props.from[category].forEach(fmt => formats[category].add(fmt));
            }
        }

        for (const category in props.to) {
            if (formats[category]) {
                props.to[category].forEach(fmt => formats[category].add(fmt));
            }
        }
    }

    // Convert Sets to Arrays
    return Object.fromEntries(
        Object.entries(formats).map(([cat, set]) => [cat, Array.from(set)])
    );
}

module.exports = {
    getConverter,
    findConverter,
    getAllConverters,
    getSupportedFormats,
    converterRegistry
};
