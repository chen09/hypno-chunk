import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get audio directory from environment variable
    const audioDir = process.env.AUDIO_DIR || (() => {
      const projectRoot = path.resolve(process.cwd(), '..');
      return path.join(projectRoot, 'data', '2_audio_output');
    })();

    // Reconstruct filename from path array
    const filename = params.path.join('/');
    
    // Security: Prevent path traversal attacks
    if (filename.includes('..') || path.isAbsolute(filename)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Construct full file path
    const filePath = path.join(audioDir, filename);
    
    // Ensure the file is within the audio directory (additional security check)
    const resolvedAudioDir = path.resolve(audioDir);
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(resolvedAudioDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    // Determine Content-Type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.mp3') {
      contentType = 'audio/mpeg';
    } else if (ext === '.srt') {
      contentType = 'text/plain; charset=utf-8';
    }

    // Handle Range requests for audio streaming
    const range = request.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      
      const fileStream = fs.createReadStream(filePath, { start, end });
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
      };

      return new NextResponse(fileStream as unknown as ReadableStream, {
        status: 206,
        headers,
      });
    }

    // Full file response - use stream for large files
    const fileStream = fs.createReadStream(filePath);
    return new NextResponse(fileStream as unknown as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

