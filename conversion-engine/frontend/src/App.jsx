import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import './App.css';
import { useJobs } from './hooks/useJobs';

// Constants
const FORMAT_CATEGORIES = {
    image: { icon: '🖼️', formats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'ico'] },
    video: { icon: '🎬', formats: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv'] },
    audio: { icon: '🎵', formats: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] },
    document: { icon: '📄', formats: ['pdf', 'docx', 'txt', 'html'] }
};

const ALL_FORMATS = [
    { value: 'png', label: 'PNG Image', category: 'image' },
    { value: 'jpg', label: 'JPG Image', category: 'image' },
    { value: 'webp', label: 'WebP Image', category: 'image' },
    { value: 'gif', label: 'GIF Animation', category: 'image' },
    { value: 'mp4', label: 'MP4 Video', category: 'video' },
    { value: 'webm', label: 'WebM Video', category: 'video' },
    { value: 'mkv', label: 'MKV Video', category: 'video' },
    { value: 'mp3', label: 'MP3 Audio', category: 'audio' },
    { value: 'wav', label: 'WAV Audio', category: 'audio' },
    { value: 'pdf', label: 'PDF Document', category: 'document' },
    { value: 'docx', label: 'Word Document', category: 'document' }
];

const PRESETS = [
    { id: 'quality', label: '💎 Best Quality', description: 'Maximum quality, larger files' },
    { id: 'balanced', label: '⚖️ Balanced', description: 'Good quality, optimized size' },
    { id: 'speed', label: '⚡ Fastest', description: 'Quick conversion, smaller files' },
    { id: 'web', label: '🌐 Web Optimized', description: 'Perfect for web delivery' }
];

// Helper functions
const getFileCategory = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    for (const [category, data] of Object.entries(FORMAT_CATEGORIES)) {
        if (data.formats.includes(ext)) return category;
    }
    return 'document';
};

const getFileIcon = (filename) => FORMAT_CATEGORIES[getFileCategory(filename)]?.icon || '📁';

const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function App() {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg, type = 'info') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const { jobs, processing, setProcessing, processFile, cancelJob, clearJobs } = useJobs(showToast);

    const [selectedFormat, setSelectedFormat] = useState('png');
    const [selectedPreset, setSelectedPreset] = useState('balanced');
    const [isDragging, setIsDragging] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [suggestedFormats, setSuggestedFormats] = useState(ALL_FORMATS);

    const fileInputRef = useRef(null);
    const dragCounter = useRef(0);

    const handleFilesSelected = (files) => {
        setPendingFiles(files);
        if (files.length > 0) {
            const category = getFileCategory(files[0].name);
            const suggested = ALL_FORMATS.filter(f => f.category === category);
            setSuggestedFormats(suggested.length > 0 ? suggested : ALL_FORMATS);
            if (suggested.length > 0 && !suggested.find(f => f.value === selectedFormat)) {
                setSelectedFormat(suggested[0].value);
            }
        }
    };

    const startProcessing = async () => {
        if (pendingFiles.length === 0) return;
        setProcessing(true);
        for (const file of pendingFiles) {
            await processFile(file, selectedFormat, selectedPreset);
        }
        setPendingFiles([]);
    };

    const handleDownloadAll = async () => {
        const completed = jobs.filter(j => j.status === 'completed');
        if (completed.length === 0) return;

        if (completed.length === 1) {
            window.location.href = `/api/download/${completed[0].jobId}`;
        } else {
            // Bulk ZIP Logic
            try {
                showToast('Preparing ZIP...', 'info');
                const zip = new JSZip();
                for (const job of completed) {
                    const res = await fetch(`/api/download/${job.jobId}`);
                    const blob = await res.blob();
                    zip.file(`${job.filename.split('.')[0]}.${job.format}`, blob);
                }
                const content = await zip.generateAsync({ type: 'blob' });
                const url = window.URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = `converted_files_${Date.now()}.zip`;
                a.click();
            } catch (err) {
                showToast('ZIP failed', 'error');
            }
        }
    };

    const avgProgress = jobs.length > 0 ? jobs.reduce((acc, j) => acc + (j.progress || 0), 0) / jobs.length : 0;
    const allFinished = jobs.length > 0 && jobs.every(j => ['completed', 'failed', 'cancelled'].includes(j.status));

    return (
        <div className="app">
            <div className="bg-blobs">
                <motion.div className="blob blob-1" animate={{ x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity }} />
                <motion.div className="blob blob-2" animate={{ x: [0, -50, 0], y: [0, -30, 0] }} transition={{ duration: 12, repeat: Infinity }} />
            </div>

            <div className="container">
                <header>
                    <div className="logo">
                        <div className="logo-symbol" />
                        <span>ANTIGRAVITY</span>
                    </div>
                    <div className="status">
                        <span className="status-dot healthy" />
                        SYSTEM_ONLINE_v3.1
                    </div>
                </header>

                <main>
                    <section className="hero">
                        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <span className="gradient-text">Conversion,</span><br />
                            Reimagined.
                        </motion.h1>

                        <div
                            className={`engine-card ${isDragging ? 'dragging' : ''} ${pendingFiles.length > 0 ? 'has-files' : ''}`}
                            onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; handleFilesSelected(Array.from(e.dataTransfer.files)); }}
                        >
                            {pendingFiles.length > 0 && (
                                <div className="pending-files">
                                    <div className="pending-header">
                                        <span>{pendingFiles.length} file(s) selected</span>
                                    </div>
                                    <div className="pending-list">
                                        {pendingFiles.slice(0, 3).map((f, i) => (
                                            <div key={i} className="pending-file">
                                                <span>{getFileIcon(f.name)} {f.name}</span>
                                                <small>{formatFileSize(f.size)}</small>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {pendingFiles.length > 0 && (
                                <div className="presets">
                                    {PRESETS.map(p => (
                                        <button key={p.id} className={`preset-btn ${selectedPreset === p.id ? 'active' : ''}`} onClick={() => setSelectedPreset(p.id)}>{p.label}</button>
                                    ))}
                                </div>
                            )}

                            <div className="actions">
                                {pendingFiles.length === 0 ? (
                                    <button className="btn btn-primary" onClick={() => fileInputRef.current.click()}>Upload Files</button>
                                ) : (
                                    <button className="btn btn-primary btn-convert" onClick={startProcessing}>Convert Now</button>
                                )}

                                <select className="format-select" value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)}>
                                    <optgroup label="Suggested">
                                        {suggestedFormats.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </optgroup>
                                    <optgroup label="All">
                                        {ALL_FORMATS.filter(f => !suggestedFormats.includes(f)).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                            <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFilesSelected(Array.from(e.target.files))} style={{ display: 'none' }} />
                        </div>
                    </section>

                    <section className="bento-grid">
                        <div className="bento-item"><h3>Smart Engine</h3><p>Automatically selects the best processing parameters.</p></div>
                        <div className="bento-item"><h3>High Confidence</h3><p>Magic-byte validation ensures file integrity.</p></div>
                        <div className="bento-item"><h3>Auto Purge</h3><p>Files are automatically deleted after processing.</p></div>
                    </section>
                </main>
            </div>

            <AnimatePresence>
                {processing && (
                    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="modal">
                            <h2>{allFinished ? '✨ Processing Complete' : '⚡ Conversion Engine Active'}</h2>
                            <div className="progress-container">
                                <div className="progress-track"><div className="progress-bar" style={{ width: `${avgProgress}%` }} /></div>
                                <span>{Math.round(avgProgress)}%</span>
                            </div>

                            <div className="file-list">
                                {jobs.map(j => (
                                    <div key={j.jobId} className={`file-row ${j.status}`}>
                                        <span>{getFileIcon(j.filename)} {j.filename}</span>
                                        <span className="file-status">
                                            {j.status === 'completed' ? 'DONE' : j.status === 'failed' ? 'ERROR' : j.status === 'cancelled' ? 'CANCELLED' : `${Math.round(j.progress)}%`}
                                        </span>
                                        {!['completed', 'failed', 'cancelled'].includes(j.status) && (
                                            <button onClick={() => cancelJob(j.jobId)}>✕</button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions">
                                {allFinished && <button className="btn btn-primary" onClick={handleDownloadAll}>Download Result</button>}
                                <button className="btn btn-secondary" onClick={clearJobs}>Close</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {toast && (
                    <motion.div className={`toast toast-${toast.type}`} initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}>
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
