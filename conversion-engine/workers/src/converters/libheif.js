const BaseConverter = require('./base');

/**
 * libheif Converter - HEIC/HEIF to raster formats
 * Handles Apple iPhone photos (HEIC) conversion
 */
class LibheifConverter extends BaseConverter {
    constructor() {
        super('libheif', {
            from: {
                images: ['heic', 'heif']
            },
            to: {
                images: ['jpg', 'jpeg', 'png']
            }
        });
    }

    /**
     * Convert HEIC/HEIF to JPG or PNG
     * @param {string} input - Input file path
     * @param {string} output - Output file path
     * @param {string} format - Target format (jpg, png)
     * @param {string} preset - quality/balanced/speed
     * @param {Object} job - Bull job instance
     * @returns {Promise<{time: number}>}
     */
    async convert(input, output, format, preset, job) {
        const resolvedInput = this.validateInput(input);
        const resolvedOutput = require('path').resolve(output);

        await job.progress(10);

        // heif-convert input.heic output.jpg
        // Quality is controlled via preset
        const quality = this._getQuality(preset);
        const args = [
            resolvedInput,
            resolvedOutput
        ];

        // Add quality parameter if supported (may vary by libheif version)
        if (quality && format === 'jpg') {
            args.push('-q', quality.toString());
        }

        return await this.executeCommand('heif-convert', args, job);
    }

    _getQuality(preset) {
        const qualityMap = {
            'quality': 100,
            'balanced': 92,
            'speed': 85,
            'web': 88
        };
        return qualityMap[preset] || qualityMap['balanced'];
    }
}

module.exports = new LibheifConverter();
