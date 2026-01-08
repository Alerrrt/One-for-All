# One-for-All

Open-source toolkit for local processing. Your data never leaves your machine.

## File Conversion Engine

Convert 250+ file formats locally. No cloud, no tracking, no limits.

**Features**
- **Images:** PNG, JPG, WebP, GIF, BMP, TIFF, ICO, **HEIC**, **HEIF**, **SVG**, **EPS**, **EMF**, **WMF**
- **Video:** MP4, WebM, MKV, AVI, MOV, FLV
- **Audio:** MP3, WAV, FLAC, AAC, OGG, M4A
- **Documents:** PDF, DOCX, **DOC**, **ODT**, **RTF**, **EPUB**, **HTML**, **Pages**, **WordPerfect (WPD)**, TXT
- **Data:** **JSON**, **YAML**, **TOML**, **XML**, **CSV**
- **Vector Graphics:** **SVG**, **PDF**, **EPS**, **PS**, **EMF**, **WMF**, **DXF**
- **200+ total formats** supported
- Real-time progress tracking
- Bulk processing with ZIP download
- Docker deployment
- **Phase 1 Complete:** Dasel, libheif, Inkscape, LibreOffice converters active

**Privacy First**
- 100% local processing
- Zero data storage or transmission
- No accounts required
- Open source (MIT)

**Quick Start**
```bash
cd conversion-engine
docker-compose up -d
# Access at http://localhost:3000
```

See [conversion-engine/README.md](conversion-engine/README.md) for details.

**🎉 NEW: Phase 1 ConvertX Integration Complete**
- 4 new converters added (Dasel, libheif, Inkscape, LibreOffice)
- Format support expanded from 40 → 200+ formats
- See [conversion-engine/PHASE1_DEPLOYMENT.md](conversion-engine/PHASE1_DEPLOYMENT.md) for deployment guide

---

## Security

Production-grade security without enterprise cost:
- Multi-layer file validation
- Path traversal protection
- Command injection prevention
- Zero known high/critical CVEs
- Last audit: January 2026

---

## Contributing

Fork, branch, submit PR. All contributions welcome.

---

## License

MIT - Free for personal and commercial use.
