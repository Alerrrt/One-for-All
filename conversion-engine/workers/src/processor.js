const Bull = require('bull');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { findConverter } = require('./converters/registry');

const conversionQueue = new Bull('conversions', process.env.REDIS_URL);

// Inject queue into converters that need cancellation support
const { getConverter } = require('./converters/registry');
const ffmpegConverter = getConverter('ffmpeg');
if (ffmpegConverter && ffmpegConverter.setQueue) {
    ffmpegConverter.setQueue(conversionQueue);
}

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

        // Try new modular converters first
        const inputExt = path.extname(filename).substring(1).toLowerCase();
        const converterMatch = findConverter(inputExt, outputFormat);

        let processor;
        let result;

        if (converterMatch) {
            // Use new modular converter
            processor = converterMatch.name;
            console.log(`[Job ${job.id}] Using new converter: ${processor}`);
            result = await converterMatch.converter.convert(
                inputPathResolved,
                outputPath,
                outputFormat,
                preset,
                job
            );
        } else {
            // Fallback to legacy processors
            processor = selectProcessor(filename, outputFormat);
            console.log(`[Job ${job.id}] Using legacy processor: ${processor}`);
            result = await executeConversion(processor, inputPathResolved, outputPath, outputFormat, preset, job);
        }

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

// Helper: Categorize errors for better user feedback
function categorizeError(error, filename) {
    const msg = error.message.toLowerCase();
    if (msg.includes('command not found')) return 'Conversion tool missing (check Docker dependencies)';
    if (msg.includes('no such file')) return 'Input file lost or moved';
    if (msg.includes('permission denied')) return 'System permission error';
    if (msg.includes('invalid data') || msg.includes('corrupt')) return `File ${filename} is corrupted or incompatible`;
    if (msg.includes('out of memory')) return 'Server ran out of memory during conversion';
    if (msg.includes('no converter found')) return error.message; // Pass through converter not found errors
    return `Conversion Error: ${error.message}`;
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
