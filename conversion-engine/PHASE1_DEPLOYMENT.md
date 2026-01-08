# Phase 1 Deployment Guide

## ✅ Phase 1 Complete - ConvertX Converter Integration

This document describes the Phase 1 implementation of ConvertX conversion types adoption.

### What's New

**4 New Converters Added:**
1. **Dasel** - Data format interchange (JSON ↔ YAML ↔ TOML ↔ CSV)
2. **libheif** - HEIC/HEIF support (iPhone photos)
3. **Inkscape** - Vector graphics (SVG, EPS, PDF, EMF, WMF)
4. **LibreOffice** - Office documents (40+ formats)

**Format Coverage:**
- **Before Phase 1:** ~40 formats
- **After Phase 1:** 200+ formats  
- **Increase:** 5x format expansion

### Architecture Changes

**New Modular Converter System:**
- Base converter class (`converters/base.js`)
- Converter registry with automatic selection (`converters/registry.js`)
- Prioritized converter matching (specialized tools first)
- Backward compatible with existing FFmpeg, ImageMagick, Pandoc

**Worker Intelligence:**
1. Detects input format from file extension
2. Finds best converter via registry
3. Falls back to legacy processors if no match
4. Example: HEIC → libheif (not ImageMagick)

### Quick Start

#### 1. Rebuild Docker Images

```bash
cd /Users/rick/one-for-all/conversion-engine

# Rebuild worker with new Phase 1 dependencies
docker-compose build worker-ffmpeg worker-image

# Or rebuild all
docker-compose build
```

#### 2. Deploy

```bash
# Start all services
docker-compose up -d

# Verify new converters are available
docker exec conversion-worker-ffmpeg dasel --version
docker exec conversion-worker-ffmpeg heif-convert --version
docker exec conversion-worker-ffmpeg inkscape --version
docker exec conversion-worker-ffmpeg soffice --version
```

#### 3. Test Phase 1 Converters

**Test Dasel (JSON → YAML):**
```bash
echo '{"name": "test", "value": 123}' > test.json
curl -F "file=@test.json" -F "format=yaml" http://localhost:3000/api/convert
# Check job status, download result
```

**Test libheif (HEIC → JPG):**
```bash
# Upload an iPhone HEIC photo
curl -F "file=@photo.heic" -F "format=jpg" http://localhost:3000/api/convert
```

**Test Inkscape (SVG → PDF):**
```bash
curl -F "file=@logo.svg" -F "format=pdf" http://localhost:3000/api/convert
```

**Test LibreOffice (DOCX → PDF):**
```bash
curl -F "file=@document.docx" -F "format=pdf" http://localhost:3000/api/convert
```

### Converter Selection Logic

The worker automatically selects the best converter:

| Input → Output | Converter Selected | Reason |
|----------------|-------------------|---------|
| HEIC → JPG | libheif | Specialized HEIC tool |
| SVG → PDF | Inkscape | Best vector quality |
| JSON → YAML | Dasel | Data interchange |
| DOCX → PDF | LibreOffice | Office docs |
| PNG → JPG | ImageMagick | Existing converter |
| MP4 → WebM | FFmpeg | Existing converter |

### Docker Image Size

**Phase 1 Worker Image:** ~3.5GB
- Node.js base: 900MB
- FFmpeg: 500MB
- ImageMagick: 200MB
- LibreOffice: 1.2GB
- Inkscape: 400MB
- Pandoc: 100MB
- libheif: 50MB
- Dasel: 20MB
- Other deps: 130MB

**Optimization Note:** For production, consider multi-worker approach (separate images):
- Media worker (FFmpeg, ImageMagick, libheif): ~2GB
- Document worker (LibreOffice, Pandoc): ~2.5GB
- Vector worker (Inkscape): ~1GB
- Data worker (Dasel): ~200MB

### Monitoring

Check which converters are being used:

```bash
# View worker logs
docker-compose logs -f worker-ffmpeg | grep "Using new converter"

# Example output:
# [Job 42] Using new converter: dasel
# [Job 43] Using new converter: libheif
# [Job 44] Using legacy processor: ffmpeg
```

### Troubleshooting

**Issue: "dasel: command not found"**
- Solution: Rebuild worker image (`docker-compose build worker-ffmpeg`)

**Issue: "soffice: command not found"**
- Solution: Ensure LibreOffice installed in Dockerfile.worker

**Issue: "No converter found for format X"**
- Check `converters/registry.js` - format may need to be added
- Check input file extension matches expected format

**Issue: Worker memory high (>2GB)**
- LibreOffice uses significant memory for large documents
- Consider reducing `WORKER_CONCURRENCY` to 2

### File Structure

```
conversion-engine/
├── workers/
│   └── src/
│       ├── converters/         # NEW: Modular converter system
│       │   ├── base.js         # Base converter class
│       │   ├── dasel.js        # Dasel converter
│       │   ├── libheif.js      # libheif converter
│       │   ├── inkscape.js     # Inkscape converter
│       │   ├── libreoffice.js  # LibreOffice converter
│       │   └── registry.js     # Converter registry
│       └── processor.js        # MODIFIED: Uses new registry
├── Dockerfile.worker           # MODIFIED: Includes Phase 1 deps
└── docker-compose.yml          # UPDATED: Comments for Phase 1
```

### What's Next: Phase 2 (Optional)

Phase 2 would add:
- **Calibre** - Ebook conversion (EPUB ↔ MOBI ↔ AZW3)
- **Potrace** - Bitmap → Vector (PNG → SVG)
- **Sharp/Vips** - High-performance image processing
- **resvg** - SVG rendering

**Estimated effort:** 4-6 weeks
**Format addition:** +150 formats

---

## Verification Checklist

- [ ] Docker images build successfully
- [ ] All 4 new converters respond to `--version` checks
- [ ] Dasel: JSON → YAML conversion works
- [ ] libheif: HEIC → JPG conversion works
- [ ] Inkscape: SVG → PDF conversion works
- [ ] LibreOffice: DOCX → PDF conversion works
- [ ] Existing conversions still work (regression test)
- [ ] Worker logs show "Using new converter" messages
- [ ] No memory leaks (<2GB RAM per worker)
- [ ] API response time <100ms (unchanged)

---

**Phase 1 Status:** ✅ Implementation Complete
**Deployment:** Ready for testing
**Next Steps:** User acceptance testing, then production deployment
