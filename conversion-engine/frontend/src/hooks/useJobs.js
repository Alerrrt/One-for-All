import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const socket = io('/', { path: '/api/socket.io' });

export function useJobs(showToast) {
    const [jobs, setJobs] = useState([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const handleProgress = ({ jobId, progress, status }) => {
            setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, status, progress } : j));
        };

        const handleCompleted = ({ jobId }) => {
            setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, status: 'completed', progress: 100 } : j));
        };

        const handleFailed = ({ jobId, error }) => {
            setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, status: 'failed', error } : j));
            showToast(`Engine Error: ${error}`, 'error');
        };

        const handleCancelled = ({ jobId }) => {
            setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, status: 'cancelled' } : j));
            showToast('Job cancelled', 'info');
        };

        socket.on('job_progress', handleProgress);
        socket.on('job_completed', handleCompleted);
        socket.on('job_failed', handleFailed);
        socket.on('job_cancelled', handleCancelled);

        return () => {
            socket.off('job_progress', handleProgress);
            socket.off('job_completed', handleCompleted);
            socket.off('job_failed', handleFailed);
            socket.off('job_cancelled', handleCancelled);
        };
    }, [showToast]);

    const addJob = useCallback((jobData) => {
        setJobs(prev => [...prev, jobData]);
        socket.emit('join_job', jobData.jobId);
    }, []);

    const processFile = async (file, format, preset) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);
        formData.append('preset', preset);

        try {
            const response = await fetch('/api/convert', { method: 'POST', body: formData });
            const data = await response.json();

            if (response.ok) {
                addJob({
                    jobId: data.jobId,
                    filename: file.name,
                    fileSize: file.size,
                    format,
                    status: 'pending',
                    progress: 0
                });
                return true;
            } else {
                showToast(`Upload Failed: ${data.error}`, 'error');
                return false;
            }
        } catch (error) {
            showToast(`System Error: ${error.message}`, 'error');
            return false;
        }
    };

    const cancelJob = async (jobId) => {
        try {
            const response = await fetch(`/api/job/${jobId}`, { method: 'DELETE' });
            if (response.ok) {
                setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, status: 'cancelled' } : j));
            }
        } catch (error) {
            showToast(`Cancel Failed: ${error.message}`, 'error');
        }
    };

    const clearJobs = () => {
        setJobs([]);
        setProcessing(false);
    };

    return {
        jobs,
        setJobs,
        processing,
        setProcessing,
        processFile,
        cancelJob,
        clearJobs
    };
}
