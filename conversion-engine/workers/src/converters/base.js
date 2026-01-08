const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Base Converter Class
 * All converter implementations should extend this or follow its interface
 */
class BaseConverter {
    constructor(name, properties) {
        this.name = name;
        this.properties = properties;
    }

    /**
     * Execute a command-line converter tool
     * @param {string} command - Command to execute (e.g., 'inkscape', 'heif-convert')
     * @param {string[]} args - Command arguments
     * @param {Object} job - Bull job instance for progress updates
     * @returns {Promise<{time: number}>} - Processing time in seconds
     */
    async executeCommand(command, args, job) {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const proc = spawn(command, args);
            let stderr = '';
            let lastProgress = 10;

            // Simple progress simulation for commands without progress output
            const progressInterval = setInterval(async () => {
                if (lastProgress < 90) {
                    lastProgress += 10;
                    await job.progress(lastProgress);
                }
            }, 1000);

            proc.stdout.on('data', (data) => {
                // Some converters output to stdout, log but don't spam
                const output = data.toString();
                if (output.includes('error') || output.includes('failed')) {
                    console.error(`[${this.name}] ${output.substring(0, 200)}`);
                }
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                clearInterval(progressInterval);
                if (code === 0) {
                    resolve({ time: (Date.now() - startTime) / 1000 });
                } else {
                    reject(new Error(`${this.name} process exited with code ${code}. stderr: ${stderr.substring(0, 500)}`));
                }
            });

            proc.on('error', (err) => {
                clearInterval(progressInterval);
                reject(new Error(`${this.name} process error: ${err.message}`));
            });
        });
    }

    /**
     * Validate input file exists
     * @param {string} inputPath - Path to input file
     * @throws {Error} if file doesn't exist
     */
    validateInput(inputPath) {
        const resolvedPath = path.resolve(inputPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }
        return resolvedPath;
    }

    /**
     * Check if this converter supports a given conversion
     * @param {string} inputFormat - Input file format
     * @param {string} outputFormat - Output file format
     * @returns {boolean}
     */
    supports(inputFormat, outputFormat) {
        // Check all categories in properties.from and properties.to
        for (const category in this.properties.from) {
            const fromFormats = this.properties.from[category] || [];
            const toFormats = this.properties.to[category] || [];

            if (fromFormats.includes(inputFormat) && toFormats.includes(outputFormat)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Convert file - must be implemented by child classes
     * @param {string} input - Input file path
     * @param {string} output - Output file path
     * @param {string} format - Target format
     * @param {string} preset - Conversion preset (quality, balanced, speed, web)
     * @param {Object} job - Bull job instance
     * @returns {Promise<{time: number}>}
     */
    async convert(input, output, format, preset, job) {
        throw new Error(`convert() must be implemented by ${this.name}`);
    }
}

module.exports = BaseConverter;
