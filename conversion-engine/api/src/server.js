const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // For initial setup only
const http = require('http');
const { Server } = require('socket.io');
const archiver = require('archiver');
const winston = require('winston');

// Internal modules
const JobService = require('./services/JobService');
const { validateFile, validateFormat, validatePreset } = require('./utils/validation');
const { generateSecureFilename, validatePathInDirectory, sanitizeFilename } = require('./utils/path-sanitizer');
const { validateEnvironment } = require('./middleware/validateEnv');

dotenv.config();

// SECURITY: Validate environment variables before starting
validateEnvironment();

// Winston Logger Setup
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'conversion-api' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || false,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize Job Service
const jobService = new JobService(process.env.REDIS_URL, io);

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || false,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE']
}));
app.use(express.json());

// API Key Authentication - SECURITY FIX: No bypass allowed
const apiKeyAuth = (req, res, next) => {
    // Health endpoint is publicly accessible
    if (req.path === '/health') return next();

    const apiKey = req.headers['x-api-key'];
    const configuredKey = process.env.API_KEY;

    // SECURITY FIX: Removed bypass logic - always require valid API key
    if (!apiKey || apiKey !== configuredKey) {
        logger.warn('Unauthorized API access attempt', {
            ip: req.ip,
            path: req.path,
            userAgent: req.headers['user-agent'],
            hasKey: !!apiKey
        });
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }
    next();
};

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Directories - Sync operations acceptable during startup
const uploadDir = process.env.UPLOAD_DIR || '/data/inputs';
const outputDir = process.env.OUTPUT_DIR || '/data/outputs';
const tempDir = process.env.TEMP_DIR || '/data/temp';

[uploadDir, outputDir, tempDir].forEach(dir => {
    if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
        logger.info('Created directory', { dir });
    }
});

// Multer Config
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || 5000) * 1024 * 1024 }
});

// Socket Connections
io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });
    socket.on('join_job', (jobId) => socket.join(`job:${jobId}`));
});

// ===================
// API Endpoints
// ===================

app.post('/api/convert', apiKeyAuth, upload.single('file'), async (req, res) => {
    let uploadedFilePath = null;
    try {
        const { format, preset } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'File is required' });
        }

        uploadedFilePath = req.file.path;

        // SECURITY: Validate format and preset parameters
        const formatValidation = validateFormat(format);
        if (!formatValidation.valid) {
            await fs.unlink(uploadedFilePath).catch(() => { });
            return res.status(400).json({ error: formatValidation.error });
        }

        const presetValidation = validatePreset(preset);
        if (!presetValidation.valid) {
            await fs.unlink(uploadedFilePath).catch(() => { });
            return res.status(400).json({ error: presetValidation.error });
        }

        // SECURITY: Validate file with magic bytes and dangerous signature check
        const validation = await validateFile(req.file.path, req.file.originalname);
        if (!validation.valid) {
            await fs.unlink(uploadedFilePath).catch(() => { });
            logger.warn('File validation failed', {
                filename: req.file.originalname,
                error: validation.error,
                ip: req.ip
            });
            return res.status(400).json({ error: validation.error });
        }

        // SECURITY: Generate secure filename to prevent path traversal
        const secureFilename = generateSecureFilename(req.file.originalname);
        const securePath = path.join(uploadDir, secureFilename);

        // Move file to secure location with secure name
        await fs.rename(uploadedFilePath, securePath);
        req.file.path = securePath;
        req.file.filename = secureFilename;

        const job = await jobService.createJob(req.file, formatValidation.format, presetValidation.preset);

        logger.info('Conversion job created', {
            jobId: job.id,
            originalName: req.file.originalname,
            format: formatValidation.format,
            fileSize: validation.fileSize,
            ip: req.ip
        });

        res.json({
            jobId: job.id,
            status: 'pending',
            message: 'Conversion queued successfully'
        });
    } catch (error) {
        // Cleanup uploaded file on error
        if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath).catch(() => { });
        }
        logger.error('Upload error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });
        res.status(500).json({ error: 'Internal system error during upload' });
    }
});

app.get('/api/status/:jobId', apiKeyAuth, async (req, res) => {
    try {
        const status = await jobService.getJobStatus(req.params.jobId);
        if (!status) return res.status(404).json({ error: 'Job not found' });
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/job/:jobId', apiKeyAuth, async (req, res) => {
    try {
        const result = await jobService.cancelJob(req.params.jobId);
        if (!result.success) return res.status(400).json({ error: result.error });
        res.json({ success: true, message: 'Job cancelled' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/download/:jobId', apiKeyAuth, async (req, res) => {
    try {
        const status = await jobService.getJobStatus(req.params.jobId);
        if (!status || !status.completed) {
            return res.status(404).json({ error: 'File not ready or job not found' });
        }

        const result = status.result;
        if (!result || !result.outputPath) {
            return res.status(404).json({ error: 'Output file not available' });
        }

        // SECURITY FIX: Validate path is within output directory (prevent path traversal)
        const pathValidation = await validatePathInDirectory(result.outputPath, outputDir);
        if (!pathValidation.valid) {
            logger.error('Path traversal attempt', {
                jobId: req.params.jobId,
                path: result.outputPath,
                error: pathValidation.error,
                ip: req.ip
            });
            return res.status(403).json({ error: 'Access denied' });
        }

        // SECURITY: Sanitize filename for download
        const sanitizedName = sanitizeFilename(status.data.originalName);
        const nameWithoutExt = sanitizedName.split('.').slice(0, -1).join('.');
        const targetFormat = result.format || status.data.outputFormat;
        const downloadName = `${nameWithoutExt}.${targetFormat}`;

        logger.info('File download', {
            jobId: req.params.jobId,
            filename: downloadName,
            ip: req.ip
        });

        res.download(pathValidation.resolvedPath, downloadName);
    } catch (error) {
        logger.error('Download error', {
            error: error.message,
            jobId: req.params.jobId,
            ip: req.ip
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/download/bulk', apiKeyAuth, async (req, res) => {
    try {
        const { jobIds } = req.body;

        if (!jobIds || !Array.isArray(jobIds)) {
            return res.status(400).json({ error: 'Invalid job IDs - array required' });
        }

        if (jobIds.length === 0) {
            return res.status(400).json({ error: 'No job IDs provided' });
        }

        // Limit bulk downloads to prevent abuse
        if (jobIds.length > 50) {
            return res.status(400).json({ error: 'Maximum 50 jobs per bulk download' });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="converted_files_${Date.now()}.zip"`);

        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.pipe(res);

        let fileCount = 0;
        for (const jobId of jobIds) {
            const status = await jobService.getJobStatus(jobId);
            if (status && status.completed && status.result?.outputPath) {
                // SECURITY: Validate each file path
                const pathValidation = await validatePathInDirectory(status.result.outputPath, outputDir);
                if (pathValidation.valid) {
                    const sanitizedName = sanitizeFilename(status.data.originalName);
                    const basename = sanitizedName.split('.').slice(0, -1).join('.');
                    const filename = `${basename}.${status.result.format || status.data.outputFormat}`;
                    archive.file(pathValidation.resolvedPath, { name: filename });
                    fileCount++;
                }
            }
        }

        if (fileCount === 0) {
            // Cancel archive if no valid files found
            archive.abort();
            return res.status(404).json({ error: 'No completed jobs found' });
        }

        await archive.finalize();

        logger.info('Bulk download', {
            jobCount: fileCount,
            totalRequested: jobIds.length,
            ip: req.ip
        });
    } catch (error) {
        logger.error('Bulk download error', {
            error: error.message,
            ip: req.ip
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/health', async (req, res) => {
    const health = { status: 'ok', timestamp: new Date(), services: {} };
    try {
        await jobService.queue.client.ping();
        health.services.redis = { status: 'healthy' };
        const counts = await jobService.queue.getJobCounts();
        health.queue = counts;
    } catch (error) {
        health.status = 'degraded';
        health.services.redis = { status: 'unhealthy', error: error.message };
    }
    res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// Automated Cleanup Logic - FIXED: Use async operations
const performCleanup = async (maxAgeHours = 24) => {
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleaned = 0;

    try {
        const files = await fs.readdir(outputDir);
        for (const file of files) {
            try {
                const filePath = path.join(outputDir, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            } catch (err) {
                logger.warn('Cleanup file error', { file, error: err.message });
            }
        }
        await jobService.cleanup(maxAgeMs);
        logger.info('Auto-cleanup finished', { cleanedFiles: cleaned });
    } catch (err) {
        logger.error('Auto-cleanup error', { error: err.message, stack: err.stack });
    }
};

// Schedule cleanup every 6 hours
setInterval(performCleanup, 6 * 60 * 60 * 1000);

const PORT = process.env.API_PORT || 3000;
server.listen(PORT, () => logger.info(`API running on port ${PORT}`));

process.on('SIGTERM', async () => {
    await jobService.queue.close();
    server.close();
    process.exit(0);
});
