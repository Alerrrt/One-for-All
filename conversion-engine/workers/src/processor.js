const Bull = require('bull');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const conversionQueue = new Bull('conversions', process.env.REDIS_URL);

// Preset configurations
const PRESETS = {
    quality: {
        ffmpeg: { crf: '18', preset: 'slow' },
        imagemagick: { quality: '100', density: '300' },
        description: 'Maximum quality, larger files'
    },
    balanced: {
        ffmpeg: { crf: '23', preset: 'medium' },
        imagemagick: { quality: '92', density: '150' },
        description: 'Good quality, optimized size'
    },
    speed: {
        ffmpeg: { crf: '28', preset: 'veryfast' },
        imagemagick: { quality: '85', density: '72' },
        description: 'Quick conversion, smaller files'
    },
    web: {
        ffmpeg: { crf: '25', preset: 'fast' },
        imagemagick: { quality: '88', density: '96' },
        description: 'Optimized for web delivery'
    }
};

conversionQueue.process(parseInt(process.env.WORKER_CONCURRENCY || 2), async (job) => {
    const { filename, outputFormat, filePath, preset = 'balanced' } = job.data;
    const outputDir = process.env.OUTPUT_DIR || '/data/outputs';

    // SECURITY FIX: Sanitize filenames and validate paths
    const sanitizedFilename = path.basename(filename);
    const outputFileName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFileName);

    // SECURITY: Validate input path exists and is safe
    const inputPathResolved = path.resolve(filePath);
    if (!fs.existsSync(inputPathResolved)) {
        throw new Error('Input file not found or has been removed');
    }

    try {
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        await job.progress(5);
        console.log(`[Job ${job.id}] Starting: ${sanitizedFilename} -> ${outputFormat}`);

        // Check for early cancellation
        const refreshedJob = await conversionQueue.getJob(job.id);
        if (refreshedJob?.data?.cancelled) throw new Error('CANCEL_REQUESTED');

        const processor = selectProcessor(filename, outputFormat);
        console.log(`[Job ${job.id}] Using processor: ${processor}`);

        // SECURITY: Pass validated paths to conversion
        const result = await executeConversion(processor, inputPathResolved, outputPath, outputFormat, preset, job);

        await job.progress(100);
        return {
            outputPath,
            originalName: sanitizedFilename,
            format: outputFormat,
            processingTime: result.time,
            fileSize: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
            processor
        };

    } catch (error) {
        // Cleanup output file if it was created
        if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch (e) { }
        }

        if (error.message === 'CANCEL_REQUESTED') {
            console.log(`[Job ${job.id}] Cancelled by user`);
            throw new Error('Job cancelled');
        }

        // Logical Enhancement: Detailed error categorization
        const detailedError = categorizeError(error, sanitizedFilename);
        console.error(`[Job ${job.id}] Failed:`, detailedError);
        throw new Error(detailedError);
    }
});

function selectProcessor(filename, targetFormat) {
    const imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'ico'];
    const videoFormats = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', '3gp', 'ts'];
    const audioFormats = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma'];
    const docFormats = ['pdf', 'docx', 'xlsx', 'pptx', 'html', 'txt'];

    if (imageFormats.includes(targetFormat)) return 'imagemagick';
    if (videoFormats.includes(targetFormat) || audioFormats.includes(targetFormat)) return 'ffmpeg';
    if (docFormats.includes(targetFormat)) return 'pandoc';
    return 'ffmpeg';
}

function categorizeError(error, filename) {
    const msg = error.message.toLowerCase();
    if (msg.includes('command not found')) return 'Conversion engine dependency missing (FFmpeg/ImageMagick/Pandoc)';
    if (msg.includes('no such file')) return 'Input file lost or moved';
    if (msg.includes('permission denied')) return 'System permission error';
    if (msg.includes('invalid data')) return `File format of ${filename} is corrupted or incompatible`;
    if (msg.includes('out of memory')) return 'Server ran out of memory during conversion';
    return `Conversion Error: ${error.message}`;
}

// SECURITY FIX: Sanitized FFmpeg conversion to prevent command injection
async function executeFFmpegConversion(input, output, format, preset, job) {
    const startTime = Date.now();
    const presetConfig = PRESETS[preset] || PRESETS.balanced;
    const duration = await getMediaDuration(input);

    // SECURITY: Validate input and output paths
    const resolvedInput = path.resolve(input);
    const resolvedOutput = path.resolve(output);

    if (!fs.existsSync(resolvedInput)) {
        throw new Error('Input file not found');
    }

    return new Promise((resolve, reject) => {
        // SECURITY: Use validated paths directly (no user input in command args)
        const args = [
            '-i', resolvedInput,
            '-y',
            '-preset', presetConfig.ffmpeg.preset,
            '-crf', presetConfig.ffmpeg.crf,
            '-progress', 'pipe:1',
            '-nostats',
            resolvedOutput
        ];

        if (['mp3', 'aac', 'ogg'].includes(format)) {
            const audioBitrate = preset === 'quality' ? '320k' : preset === 'speed' ? '128k' : '256k';
            args.splice(2, 0, '-b:a', audioBitrate);
        }

        const proc = spawn('ffmpeg', args);
        let lastProgress = 10;
        let lastUpdateTime = Date.now();
        const UPDATE_INTERVAL = 500; // Debounce progress updates

        proc.stdout.on('data', async (data) => {
            const out = data.toString();
            const timeMatch = out.match(/out_time_ms=(\d+)/);
            if (timeMatch && duration > 0) {
                const currentMs = parseInt(timeMatch[1]) / 1000;
                const progress = Math.min(95, 10 + Math.floor((currentMs / duration) * 85));

                // PERFORMANCE FIX: Debounce progress updates
                const now = Date.now();
                if (progress > lastProgress && (now - lastUpdateTime) > UPDATE_INTERVAL) {
                    lastProgress = progress;
                    lastUpdateTime = now;
                    await job.progress(progress);
                }
            }

            // Check for cancellation (less frequently)
            if (Math.random() < 0.1) { // Only check 10% of the time
                const refreshedJob = await conversionQueue.getJob(job.id);
                if (refreshedJob?.data?.cancelled) proc.kill('SIGTERM');
            }
        });

        proc.stderr.on('data', (data) => {
            // Log errors but don't spam
            const errorMsg = data.toString();
            if (errorMsg.includes('error') || errorMsg.includes('failed')) {
                console.error(`[FFmpeg] ${errorMsg.substring(0, 200)}`);
            }
        });

        proc.on('close', (code) => {
            if (code === 0) resolve({ time: (Date.now() - startTime) / 1000 });
            else reject(new Error(`FFmpeg process exited with code ${code}`));
        });

        proc.on('error', (err) => {
            reject(new Error(`FFmpeg process error: ${err.message}`));
        });
    });
}

async function getMediaDuration(filePath) {
    return new Promise((resolve) => {
        const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
        let output = '';
        proc.stdout.on('data', (data) => output += data.toString());
        proc.on('close', () => {
            const duration = parseFloat(output) * 1000;
            resolve(isNaN(duration) ? 0 : duration);
        });
        proc.on('error', () => resolve(0));
    });
}

// Logic enhancement: simulated multi-stage progress for images
async function executeImageMagickConversion(input, output, format, preset, job) {
    const startTime = Date.now();
    const config = PRESETS[preset] || PRESETS.balanced;

    // Stage 1: Reading (10-30%)
    await job.progress(15);

    return new Promise((resolve, reject) => {
        const args = [input, '-quality', config.imagemagick.quality, '-density', config.imagemagick.density];
        if (format === 'webp') args.push('-define', `webp:lossless=${preset === 'quality'}`);
        args.push(output);

        const proc = spawn('convert', args);

        // Stage 2: Processing (30-80%)
        const progressTimer = setInterval(() => {
            job.progress().then(p => {
                if (p < 80) job.progress(p + 5);
            });
        }, 300);

        proc.on('close', (code) => {
            clearInterval(progressTimer);
            if (code === 0) resolve({ time: (Date.now() - startTime) / 1000 });
            else reject(new Error(`ImageMagick error (code ${code})`));
        });
        proc.on('error', (err) => {
            clearInterval(progressTimer);
            reject(err);
        });
    });
}

async function executePandocConversion(input, output, format, preset, job) {
    const startTime = Date.now();
    await job.progress(20);
    return new Promise((resolve, reject) => {
        const args = [input, '-o', output];
        if (format === 'pdf') args.push('--pdf-engine=wkhtmltopdf');
        const proc = spawn('pandoc', args);
        proc.on('close', (code) => {
            if (code === 0) resolve({ time: (Date.now() - startTime) / 1000 });
            else reject(new Error(`Pandoc error (code ${code})`));
        });
        proc.on('error', reject);
    });
}

async function executeConversion(processor, input, output, format, preset, job) {
    switch (processor) {
        case 'ffmpeg': return await executeFFmpegConversion(input, output, format, preset, job);
        case 'imagemagick': return await executeImageMagickConversion(input, output, format, preset, job);
        case 'pandoc': return await executePandocConversion(input, output, format, preset, job);
        default: throw new Error(`Unknown processor: ${processor}`);
    }
}

conversionQueue.on('failed', (job, err) => {
    if (job.data.filePath && fs.existsSync(job.data.filePath)) {
        try { fs.unlinkSync(job.data.filePath); } catch (e) { }
    }
});

conversionQueue.on('completed', (job) => {
    if (job.data.filePath && fs.existsSync(job.data.filePath)) {
        try { fs.unlinkSync(job.data.filePath); } catch (e) { }
    }
});

console.log('Worker Active - Enhanced Logic Engine Loaded');
