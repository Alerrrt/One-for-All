const BaseConverter = require('./base');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * FFmpeg Converter - Video & Audio conversion
 * Handles 500+ media formats with real-time progress tracking
 */
class FFmpegConverter extends BaseConverter {
    constructor() {
        super('ffmpeg', {
            from: {
                video: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', '3gp', 'ts', 'm4v', 'mpg', 'mpeg', 'wmv', 'vob'],
                audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'alac', 'ape', 'amr']
            },
            to: {
                video: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', '3gp', 'ts', 'm4v', 'mpg'],
                audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma']
            }
        });

        // Preset configurations (migrated from processor.js PRESETS)
        this.presets = {
            quality: { crf: '18', preset: 'slow', audioBitrate: '320k' },
            balanced: { crf: '23', preset: 'medium', audioBitrate: '256k' },
            speed: { crf: '28', preset: 'veryfast', audioBitrate: '128k' },
            web: { crf: '25', preset: 'fast', audioBitrate: '192k' }
        };

        this.queue = null; // Will be injected for cancellation support
    }

    /**
     * Convert video/audio using FFmpeg
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
        const presetConfig = this.presets[preset] || this.presets.balanced;

        // Get media duration for accurate progress tracking
        const duration = await this.getMediaDuration(resolvedInput);

        await job.progress(5);

        return new Promise((resolve, reject) => {
            const args = [
                '-i', resolvedInput,
                '-y',  // Overwrite output
                '-preset', presetConfig.preset,
                '-crf', presetConfig.crf,
                '-progress', 'pipe:1',  // Progress to stdout
                '-nostats',
                resolvedOutput
            ];

            // Audio-specific settings
            if (['mp3', 'aac', 'ogg', 'm4a', 'opus'].includes(format)) {
                args.splice(2, 0, '-b:a', presetConfig.audioBitrate);
            }

            const proc = spawn('ffmpeg', args);
            let lastProgress = 10;
            let lastUpdateTime = Date.now();
            const UPDATE_INTERVAL = 500; // Debounce: update max once per 500ms

            proc.stdout.on('data', async (data) => {
                const output = data.toString();

                // Parse FFmpeg progress: "out_time_ms=12345678"
                const timeMatch = output.match(/out_time_ms=(\d+)/);
                if (timeMatch && duration > 0) {
                    const currentMs = parseInt(timeMatch[1]) / 1000;
                    // Map 0-duration to 10-95% progress
                    const progress = Math.min(95, 10 + Math.floor((currentMs / duration) * 85));

                    // Debounce: only update if progress increased and interval passed
                    const now = Date.now();
                    if (progress > lastProgress && (now - lastUpdateTime) > UPDATE_INTERVAL) {
                        lastProgress = progress;
                        lastUpdateTime = now;
                        await job.progress(progress);
                    }
                }

                // Check for job cancellation (probabilistic to reduce load)
                if (Math.random() < 0.1 && this.queue) {
                    const refreshedJob = await this.queue.getJob(job.id);
                    if (refreshedJob?.data?.cancelled) {
                        proc.kill('SIGTERM');
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                // FFmpeg outputs to stderr; log errors only
                const errorMsg = data.toString();
                if (errorMsg.toLowerCase().includes('error') || errorMsg.toLowerCase().includes('failed')) {
                    console.error(`[FFmpeg] ${errorMsg.substring(0, 200)}`);
                }
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({ time: (Date.now() - startTime) / 1000 });
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`FFmpeg process error: ${err.message}`));
            });
        });
    }

    /**
     * Get media duration using ffprobe
     * @param {string} filePath - Media file path
     * @returns {Promise<number>} Duration in milliseconds
     */
    async getMediaDuration(filePath) {
        return new Promise((resolve) => {
            const proc = spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                filePath
            ]);

            let output = '';
            proc.stdout.on('data', (data) => output += data.toString());
            proc.on('close', () => {
                const duration = parseFloat(output) * 1000; // Convert to ms
                resolve(isNaN(duration) ? 0 : duration);
            });
            proc.on('error', () => resolve(0)); // Graceful fallback
        });
    }

    /**
     * Set queue reference for job cancellation
     * @param {Bull.Queue} queue - Bull queue instance
     */
    setQueue(queue) {
        this.queue = queue;
    }
}

module.exports = new FFmpegConverter();
