const BaseConverter = require('./base');

/**
 * Inkscape Converter - Vector graphics manipulation
 * Best-in-class for SVG, EPS, PDF conversion
 * Handles EMF/WMF (Windows metafiles) better than ImageMagick
 */
class InkscapeConverter extends BaseConverter {
    constructor() {
        super('inkscape', {
            from: {
                vector: ['svg', 'pdf', 'eps', 'ps', 'wmf', 'emf', 'png']
            },
            to: {
                vector: [
                    'svg', 'svgz', 'pdf', 'ps', 'eps',
                    'png', 'emf', 'wmf',
                    'dxf', 'html', 'tex'
                ]
            }
        });
    }

    /**
     * Convert vector graphics using Inkscape
     * @param {string} input - Input file path
     * @param {string} output - Output file path
     * @param {string} format - Target format
     * @param {string} preset - quality/balanced/speed (affects DPI for raster outputs)
     * @param {Object} job - Bull job instance
     * @returns {Promise<{time: number}>}
     */
    async convert(input, output, format, preset, job) {
        const resolvedInput = this.validateInput(input);
        const resolvedOutput = require('path').resolve(output);

        await job.progress(10);

        // Inkscape command: inkscape input.svg -o output.pdf
        const args = [resolvedInput, '-o', resolvedOutput];

        // Add DPI for raster outputs (PNG)
        if (format === 'png') {
            const dpi = this._getDPI(preset);
            args.push('--export-dpi', dpi.toString());
        }

        // Add export area options for better results
        if (['pdf', 'eps', 'ps'].includes(format)) {
            args.push('--export-area-page');
        }

        return await this.executeCommand('inkscape', args, job);
    }

    _getDPI(preset) {
        const dpiMap = {
            'quality': 300,
            'balanced': 150,
            'speed': 96,
            'web': 96
        };
        return dpiMap[preset] || dpiMap['balanced'];
    }
}

module.exports = new InkscapeConverter();
