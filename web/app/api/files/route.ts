import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Definition of the FileObject interface
interface FileObject {
  filename: string;
  path: string; // Relative path for the frontend to access
  size: number;
  date: string;
}

export async function GET() {
  try {
    // Use environment variable AUDIO_DIR if set, otherwise use default relative path
    const audioDir = process.env.AUDIO_DIR || (() => {
      const projectRoot = path.resolve(process.cwd(), '..');
      return path.join(projectRoot, 'data', '2_audio_output');
    })();
    
    // If we are on the server (production), the path might need adjustment 
    // if the app is built and running from a different location.
    // But assuming standard deployment where we run from 'web' folder:
    
    if (!fs.existsSync(audioDir)) {
      console.error(`Directory not found: ${audioDir}`);
      return NextResponse.json({ error: 'Audio directory not found' }, { status: 404 });
    }

    const files: FileObject[] = [];

    // Only scan root directory, not subdirectories
    const items = fs.readdirSync(audioDir);

    for (const item of items) {
      const fullPath = path.join(audioDir, item);
      const stat = fs.statSync(fullPath);

      // Only include files (not directories) that end with _merged_final.mp3
      if (stat.isFile() && item.toLowerCase().endsWith('_merged_final.mp3')) {
        files.push({
          filename: item,
          path: `/audio/${item}`,
          size: stat.size,
          date: stat.mtime.toISOString(),
        });
      }
    }

    // Sort by date modified (newest first) or filename
    files.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error reading audio directory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

