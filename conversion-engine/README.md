# 🚀 ANTIGRAVITY - File Conversion Engine

A private, self-hosted file conversion engine that converts 250+ file formats with zero-lag performance through queue-based async architecture.

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-blue)

## ✨ Features

- **250+ Formats** - Images, video, audio, and documents
- **Zero-Lag** - Queue-based architecture handles 100+ concurrent users
- **100% Private** - All processing stays on your server
- **Real-Time Progress** - WebSocket-powered live updates
- **Drag & Drop** - Modern, intuitive UI
- **Conversion Presets** - Quality, Balanced, Speed, Web Optimized
- **Bulk Processing** - Convert multiple files with ZIP download
- **Auto-Cleanup** - Configurable file retention

## 🏗️ Architecture

```
┌─ React SPA (Frontend)
│   ├─ Drag & drop upload
│   ├─ Real-time progress
│   └─ Preset selection
│
├─ Express.js API
│   ├─ File upload handler
│   ├─ Job management
│   └─ WebSocket events
│
├─ Bull Queue + Redis
│   ├─ Job queuing
│   ├─ Priority handling
│   └─ Auto-retry
│
├─ Worker Pool
│   ├─ FFmpeg (video/audio)
│   ├─ ImageMagick (images)
│   └─ Pandoc (documents)
│
└─ Nginx Reverse Proxy
    ├─ Rate limiting
    └─ Static file serving
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- 4GB+ RAM recommended

### 1. Clone & Configure

```bash
git clone <your-repo>
cd conversion-engine
cp .env.example .env
```

### 2. Edit Configuration

```bash
# .env
API_KEY=your_secure_api_key     # Optional: API authentication
DB_PASSWORD=your_db_password     # PostgreSQL password
```

### 3. Deploy

```bash
docker-compose up -d
```

### 4. Access

Open `http://localhost:3000` in your browser.

## 📋 Supported Formats

| Category | Formats |
|----------|---------|
| **Images** | PNG, JPG, WebP, GIF, BMP, TIFF, ICO |
| **Video** | MP4, WebM, MKV, AVI, MOV, FLV |
| **Audio** | MP3, WAV, FLAC, AAC, OGG, M4A |
| **Documents** | PDF, DOCX, TXT, HTML |

## 🔧 API Reference

### Convert File

```bash
POST /api/convert
Content-Type: multipart/form-data

# Form fields:
# - file: The file to convert
# - format: Target format (e.g., "png", "mp4")
# - preset: Optional - "quality", "balanced", "speed", "web"

# Response:
{
  "jobId": "123",
  "status": "pending",
  "message": "Conversion queued successfully"
}
```

### Check Status

```bash
GET /api/status/:jobId

# Response:
{
  "jobId": "123",
  "status": "completed",
  "progress": 100,
  "result": { ... }
}
```

### Download Result

```bash
GET /api/download/:jobId
# Returns the converted file
```

### Cancel Job

```bash
DELETE /api/job/:jobId

# Response:
{ "success": true, "message": "Job cancelled" }
```

### Health Check

```bash
GET /health

# Response:
{
  "status": "ok",
  "services": { "redis": { "status": "healthy" } },
  "queue": { "waiting": 0, "active": 1, "completed": 42 }
}
```

### Cleanup Old Files

```bash
POST /api/cleanup?maxAge=24  # Hours
```

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | 3000 | API server port |
| `REDIS_URL` | redis://redis:6379 | Redis connection |
| `MAX_FILE_SIZE_MB` | 5000 | Max upload size |
| `WORKER_CONCURRENCY` | 2 | Jobs per worker |
| `JOB_TIMEOUT_SECONDS` | 3600 | Job timeout |
| `API_KEY` | - | Optional API authentication |

## 🔒 Security

- **API Key Auth** - Optional `X-API-Key` header authentication
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **File Validation** - Magic byte signature verification
- **Auto-Cleanup** - Configurable file retention

## 📊 Monitoring

Access health metrics at `/health`:

```json
{
  "status": "ok",
  "uptime": 86400,
  "queue": {
    "waiting": 5,
    "active": 2,
    "completed": 1542,
    "failed": 3
  },
  "disk": { "freeGB": "45.23" }
}
```

## 🛠️ Development

```bash
# Start with hot reload
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f api worker-ffmpeg
```

## 📁 Project Structure

```
conversion-engine/
├── api/                 # Express.js API server
│   └── src/server.js
├── workers/             # Job processors
│   └── src/processor.js
├── frontend/            # React SPA
│   └── src/App.jsx
├── nginx/               # Reverse proxy config
├── docker-compose.yml   # Production config
└── .env.example         # Environment template
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use for personal and commercial projects.

---

Built with ❤️ using Node.js, React, FFmpeg, and Docker
