const BaseConverter = require('./base');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Dasel Converter - Data format interchange
 * Supports: JSON ↔ YAML ↔ TOML ↔ XML ↔ CSV
 */
class DaselConverter extends BaseConverter {
    constructor() {
        super('dasel', {
            from: {
                data: ['json', 'yaml', 'yml', 'toml', 'xml', 'csv']
            },
            to: {
                data: ['json', 'yaml', 'yml', 'toml', 'csv']
            }
        });
    }

    /**
     * Convert data formats using Dasel
     * @param {string} input - Input file path
     * @param {string} output - Output file path
     * @param {string} format - Target format (json, yaml, toml, csv)
     * @param {string} preset - Not used for data conversion
     * @param {Object} job - Bull job instance
     * @returns {Promise<{time: number}>}
     */
    async convert(input, output, format, preset, job) {
        const startTime = Date.now();
        const resolvedInput = this.validateInput(input);
        const resolvedOutput = path.resolve(output);

        // Detect input format from file extension
        const inputExt = path.extname(input).substring(1).toLowerCase();
        const inputFormat = inputExt === 'yml' ? 'yaml' : inputExt;

        await job.progress(10);

        return new Promise((resolve, reject) => {
            const args = [
                '--file', resolvedInput,
                '--read', inputFormat,
                '--write', format
            ];

            const proc = spawn('dasel', args);
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', async (code) => {
                if (code === 0) {
                    // Write output to file
                    try {
                        fs.writeFileSync(resolvedOutput, stdout);
                        await job.progress(100);
                        resolve({ time: (Date.now() - startTime) / 1000 });
                    } catch (writeError) {
                        reject(new Error(`Failed to write output: ${writeError.message}`));
                    }
                } else {
                    reject(new Error(`Dasel conversion failed (code ${code}): ${stderr}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Dasel process error: ${err.message}`));
            });
        });
    }
}

module.exports = new DaselConverter();
