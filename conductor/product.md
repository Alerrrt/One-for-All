# Product Guide: File Conversion Engine

## 1. Overview

The File Conversion Engine is a web-based application designed to provide a robust and scalable solution for converting various file types. It caters to individual users who need a simple and efficient way to transform files into different formats. The application is built with a microservices architecture, featuring a React frontend, a Node.js API, and dedicated worker services for handling conversions.

## 2. Target Audience

*   **Individual Users:** The primary users are individuals who need to convert files for personal use. This includes tasks like converting documents to different formats, changing video file types, or extracting audio from video.

## 3. Core Functionalities

*   **Wide Format Support:** The engine supports a comprehensive range of file formats across different categories:
    *   **Images:** PNG, JPG, WEBP, GIF, BMP, TIFF, ICO
    *   **Video:** MP4, WEBM, MKV, AVI, MOV, FLV
    *   **Audio:** MP3, WAV, FLAC, AAC, OGG, M4A
    *   **Documents:** PDF, DOCX, TXT, HTML
*   **Batch Conversion:** Users can upload and convert multiple files at once, streamlining the conversion process for larger sets of files.
*   **Quality and Size Control:** The application provides options to balance output quality and file size, allowing users to choose between the best quality, the fastest conversion, or a balanced approach. This also includes the ability to compress files to specific target sizes (e.g., 100KB, 200KB, 20KB).

## 4. Non-Functional Requirements

*   **Performance:** The system is designed for fast conversion times and a responsive user interface to ensure a smooth user experience.
*   **Security and Privacy:** User-uploaded files are handled securely, and the system will ensure that files are deleted from the server after a reasonable period to protect user privacy.
*   **Usability:** The user interface is designed to be extremely user-friendly and intuitive, requiring no technical expertise. The core functionality is centered around a simple drag-and-drop interface, making the conversion process as straightforward as possible. The goal is to provide a "one-click" conversion experience.