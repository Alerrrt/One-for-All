const BaseConverter = require('./base');
const path = require('path');

/**
 * LibreOffice Converter - Office document conversion
 * Handles 40+ document formats including DOC, DOCX, ODT, PDF, EPUB, Pages
 */
class LibreOfficeConverter extends BaseConverter {
    constructor() {
        super('libreoffice', {
            from: {
                documents: [
                    '602', 'abw', 'csv', 'cwk', 'doc', 'docm', 'docx', 'dot', 'dotx', 'dotm',
                    'epub', 'fb2', 'fodt', 'htm', 'html', 'hwp', 'mcw', 'mw', 'mwd', 'lwp',
                    'lrf', 'odt', 'ott', 'pages', 'pdf', 'psw', 'rtf', 'sdw', 'stw', 'sxw',
                    'tab', 'tsv', 'txt', 'wn', 'wpd', 'wps', 'wpt', 'wri', 'xhtml', 'xml', 'zabw'
                ]
            },
            to: {
                documents: [
                    'csv', 'doc', 'docm', 'docx', 'dot', 'dotx', 'dotm', 'epub', 'fodt',
                    'htm', 'html', 'odt', 'ott', 'pdf', 'rtf', 'tab', 'tsv', 'txt',
                    'wps', 'wpt', 'xhtml', 'xml'
                ]
            }
        });

        // Format filters for better conversion quality (from ConvertX)
        this.filters = {
            '602': 'T602Document',
            'abw': 'AbiWord',
            'csv': 'Text',
            'doc': 'MS Word 97',
            'docm': 'MS Word 2007 XML VBA',
            'docx': 'MS Word 2007 XML',
            'dot': 'MS Word 97 Vorlage',
            'dotx': 'MS Word 2007 XML Template',
            'dotm': 'MS Word 2007 XML Template',
            'epub': 'EPUB',
            'fb2': 'Fictionbook 2',
            'fodt': 'OpenDocument Text Flat XML',
            'htm': 'HTML (StarWriter)',
            'html': 'HTML (StarWriter)',
            'odt': 'writer8',
            'ott': 'writer8_template',
            'rtf': 'Rich Text Format',
            'txt': 'Text',
            'wpd': 'WordPerfect',
            'wps': 'MS Word 97',
            'xhtml': 'HTML (StarWriter)',
            'xml': 'OpenDocument Text Flat XML'
        };
    }

    /**
     * Convert office documents using LibreOffice
     * @param {string} input - Input file path
     * @param {string} output - Output file path
     * @param {string} format - Target format
     * @param {string} preset - Not used for document conversion
     * @param {Object} job - Bull job instance
     * @returns {Promise<{time: number}>}
     */
    async convert(input, output, format, preset, job) {
        const resolvedInput = this.validateInput(input);
        const outputDir = path.dirname(path.resolve(output));

        await job.progress(10);

        // Get input format from file extension
        const inputExt = path.extname(input).substring(1).toLowerCase();

        // Build LibreOffice command
        // soffice --headless --convert-to pdf --outdir /output input.docx
        const args = ['--headless'];

        // Apply filter if available for better quality
        const inputFilter = this.filters[inputExt];
        const outputFilter = this.filters[format];

        if (inputFilter) {
            args.push(`--infilter="${inputFilter}"`);
        }

        if (outputFilter) {
            args.push('--convert-to', `${format}:${outputFilter}`);
        } else {
            args.push('--convert-to', format);
        }

        args.push('--outdir', outputDir, resolvedInput);

        return await this.executeCommand('soffice', args, job);
    }
}

module.exports = new LibreOfficeConverter();
