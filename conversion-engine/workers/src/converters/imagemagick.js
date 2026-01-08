const BaseConverter = require('./base');
const { spawn } = require('child_process');
const path = require('path');

/**
 * ImageMagick Converter - General image conversion
 * Handles 300+ image formats with quality presets
 */
class ImageMagickConverter extends BaseConverter {
    constructor() {
        super('imagemagick', {
            from: {
                images: [
                    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
                    'ico', 'psd', 'xcf', 'raw', 'cr2', 'nef', 'dng', 'arw',
                    'svg', 'pdf', 'eps', 'ai', 'ppm', 'pgm', 'pbm', 'pnm'
                ]
            },
            to: {
                images: [
                    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp',
                    'ico', 'psd', 'pdf', 'eps'
                ]
            }
        });

        // Preset configurations (migrated from processor.js PRESETS)
        this.presets = {
            quality: { quality: '100', density: '300' },
            balanced: { quality: '92', density: '150' },
            speed: { quality: '85', density: '72' },
            web: { quality: '88', density: '96' }
        };
    }

    /**
     * Convert images using ImageMagick
     * @param {string} input - Input file path
     * @param {string} output - Output file path
     * @param {string} format - Target format
     * @param {string} preset - quality/balanced/speed/web
     * @param {Object} job - Bull job instance
     * @returns {Promise<{time: number}>}
     */
    async convert(input, output, format, preset, job) {
        const startTime = Date.now();
        const resolvedInput = this.validateInput(input);
        const resolvedOutput = path.resolve(output);
        const config = this.presets[preset] || this.presets.balanced;

        await job.progress(10);

        return new Promise((resolve, reject) => {
            const args = [
                resolvedInput,
                '-quality', config.quality,
                '-density', config.density
            ];

            // WebP-specific lossless option
            if (format === 'webp') {
                args.push('-define', `webp:lossless=${preset === 'quality'}`);
            }

            args.push(resolvedOutput);

            const proc = spawn('convert', args);

            // Simulated progress tracking (ImageMagick doesn't output real-time progress)
            let currentProgress = 15;
            const progressInterval = setInterval(async () => {
                if (currentProgress < 90) {
                    currentProgress += 8;
                    await job.progress(Math.min(currentProgress, 90));
                }
            }, 300);

            proc.on('close', (code) => {
                clearInterval(progressInterval);
                if (code === 0) {
                    resolve({ time: (Date.now() - startTime) / 1000 });
                } else {
                    reject(new Error(`ImageMagick process exited with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                clearInterval(progressInterval);
                reject(new Error(`ImageMagick process error: ${err.message}`));
            });

            proc.stderr.on('data', (data) => {
                const errorMsg = data.toString();
                if (errorMsg.toLowerCase().includes('error')) {
                    console.error(`[ImageMagick] ${errorMsg.substring(0, 200)}`);
                }
            });
        });
    }
}

module.exports = new ImageMagickConverter();
