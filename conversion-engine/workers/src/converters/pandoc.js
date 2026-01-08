const BaseConverter = require('./base');

/**
 * Pandoc Converter - Document & markup conversion
 * Handles 60+ text/document formats
 */
class PandocConverter extends BaseConverter {
    constructor() {
        super('pandoc', {
            from: {
                documents: [
                    'md', 'markdown', 'txt', 'html', 'htm',
                    'docx', 'odt', 'rtf', 'tex', 'latex',
                    'rst', 'org', 'wiki', 'textile', 'epub'
                ]
            },
            to: {
                documents: [
                    'md', 'markdown', 'html', 'htm', 'pdf',
                    'docx', 'odt', 'rtf', 'tex', 'latex',
                    'rst', 'epub'
                ]
            }
        });
    }

    /**
     * Convert documents using Pandoc
     * @param {string} input - Input file path
     * @param {string} output - Output file path
     * @param {string} format - Target format
     * @param {string} preset - Not used for Pandoc
     * @param {Object} job - Bull job instance
     * @returns {Promise<{time: number}>}
     */
    async convert(input, output, format, preset, job) {
        const resolvedInput = this.validateInput(input);
        const resolvedOutput = require('path').resolve(output);

        await job.progress(15);

        const args = [resolvedInput, '-o', resolvedOutput];

        // PDF engine specification (better UTF-8 support)
        if (format === 'pdf') {
            args.push('--pdf-engine=xelatex');
        }

        return await this.executeCommand('pandoc', args, job);
    }
}

module.exports = new PandocConverter();
