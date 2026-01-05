const Bull = require('bull');
const fs = require('fs');
const winston = require('winston');

class JobService {
    constructor(redisUrl, socketIo) {
        this.queue = new Bull('conversions', redisUrl);
        this.io = socketIo;
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [new winston.transports.Console()]
        });

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.queue.on('global:progress', (jobId, progress) => {
            this.io.to(`job:${jobId}`).emit('job_progress', { jobId, progress, status: 'processing' });
        });

        this.queue.on('global:completed', (jobId, result) => {
            const parsedResult = this._tryParse(result);
            this.io.to(`job:${jobId}`).emit('job_completed', { jobId, status: 'completed', result: parsedResult });
            this.logger.info('Job completed', { jobId });
        });

        this.queue.on('global:failed', (jobId, err) => {
            this.io.to(`job:${jobId}`).emit('job_failed', { jobId, status: 'failed', error: err.message || err });
            this.logger.error('Job failed', { jobId, error: err.message || err });
        });
    }

    async createJob(file, format, preset) {
        const job = await this.queue.add({
            filename: file.filename,
            originalName: file.originalname,
            outputFormat: format,
            preset: preset || 'balanced',
            filePath: file.path,
            fileSize: file.size,
            uploadedAt: new Date()
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: false,
            timeout: parseInt(process.env.JOB_TIMEOUT_SECONDS || 3600) * 1000
        });

        this.logger.info('Conversion job created', { jobId: job.id, file: file.originalname });
        return job;
    }

    async getJobStatus(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job) return null;

        const progress = job.progress();
        const state = await job.getState();

        return {
            jobId: job.id,
            status: state,
            progress: progress || 0,
            completed: await job.isCompleted(),
            failed: await job.isFailed(),
            error: job.failedReason,
            data: job.data,
            result: job.returnvalue
        };
    }

    async cancelJob(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job) return { success: false, error: 'Job not found' };

        const state = await job.getState();
        if (state === 'completed' || state === 'failed') {
            return { success: false, error: 'Job already finished' };
        }

        if (state === 'waiting' || state === 'delayed') {
            await job.remove();
        } else {
            await job.update({ ...job.data, cancelled: true });
        }

        if (job.data.filePath && fs.existsSync(job.data.filePath)) {
            fs.unlinkSync(job.data.filePath);
        }

        this.io.to(`job:${jobId}`).emit('job_cancelled', { jobId });
        return { success: true };
    }

    async cleanup(maxAgeMs) {
        const now = Date.now();
        let cleaned = 0;

        // This part usually requires access to the output dir which might not be here
        // But we can clean the queue
        await this.queue.clean(maxAgeMs, 'completed');
        await this.queue.clean(maxAgeMs, 'failed');

        return cleaned;
    }

    _tryParse(str) {
        try {
            return typeof str === 'string' ? JSON.parse(str) : str;
        } catch (e) {
            return str;
        }
    }
}

module.exports = JobService;
