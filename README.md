# One-for-All

A comprehensive collection of production-ready applications and tools.

## Projects

### File Conversion Engine

A private, self-hosted file conversion service that converts 250+ file formats with enterprise-grade security and performance.

**Key Features:**
- Multi-format support (images, video, audio, documents)
- Queue-based async architecture for zero-lag performance
- Real-time progress tracking via WebSocket
- Drag and drop interface
- Conversion presets (Quality, Balanced, Speed, Web Optimized)
- Bulk processing with ZIP download
- Docker-ready deployment

**Security Hardened:**
- Mandatory API key authentication
- Multi-layer file validation with magic byte verification
- Path traversal protection
- Command injection prevention
- CORS restriction
- Environment validation
- Comprehensive audit logging

**Location:** `/conversion-engine`

See [conversion-engine/README.md](conversion-engine/README.md) for detailed documentation.

---

## Getting Started

Each project contains its own documentation and setup instructions. Navigate to the respective project directory for details.

### Prerequisites

- Docker and Docker Compose
- 4GB+ RAM recommended
- Node.js 20+ (for local development)

---

## Security

All projects in this repository follow security best practices:

- No default credentials in production
- Environment-based configuration
- Input validation and sanitization
- Secure file handling
- Audit logging
- Zero known high/critical CVEs

Refer to individual project security documentation for specific implementation details.

---

## License

MIT License - See individual project directories for specific license information.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Maintenance

This repository is actively maintained with regular security audits and dependency updates.

Last Security Audit: January 2026
