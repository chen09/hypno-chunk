import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Definition of the FileObject interface
interface FileObject {
  filename: string;
  displayName: string; // Human-readable name
  category?: string; // Category for grouping (e.g., "英语学习", "小说")
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

    // Load track name mapping (array format to preserve order)
    const trackNamesPath = path.join(audioDir, 'track_names.json');
    let trackNameMap: { [key: string]: string } = {};
    const trackCategoryMap: { [key: string]: string } = {};
    let trackOrder: string[] = [];
    
    if (fs.existsSync(trackNamesPath)) {
      try {
        const trackNamesContent = fs.readFileSync(trackNamesPath, 'utf-8');
        const trackNamesData = JSON.parse(trackNamesContent);
        
        // Support both array and object formats
        if (Array.isArray(trackNamesData)) {
          trackNamesData.forEach((item: { filename: string; displayName: string; category?: string }) => {
            trackNameMap[item.filename] = item.displayName;
            trackOrder.push(item.filename);
            // Store category if available
            if (item.category) {
              trackCategoryMap[item.filename] = item.category;
            }
          });
        } else {
          // Legacy object format
          trackNameMap = trackNamesData;
          trackOrder = Object.keys(trackNamesData);
        }
      } catch (error) {
        console.error('Error reading track_names.json:', error);
      }
    }

    const files: FileObject[] = [];
    const fileMap: { [key: string]: FileObject } = {};

    // Only scan root directory, not subdirectories
    const items = fs.readdirSync(audioDir);

    for (const item of items) {
      const fullPath = path.join(audioDir, item);
      const stat = fs.statSync(fullPath);

      // Only include files (not directories) that end with _merged_final.mp3
      if (stat.isFile() && item.toLowerCase().endsWith('_merged_final.mp3')) {
        // Get display name from mapping, fallback to filename without extension
        const displayName = trackNameMap[item] || item.replace('_merged_final.mp3', '');
        // Get category from mapping if available
        const category = trackCategoryMap[item] || undefined;
        
        const fileObj: FileObject = {
          filename: item,
          displayName: displayName,
          category: category,
          path: `/audio/${item}`,
          size: stat.size,
          date: stat.mtime.toISOString(),
        };
        
        files.push(fileObj);
        fileMap[item] = fileObj;
      }
    }

    // Sort by track_names.json order if available, otherwise by date
    if (trackOrder.length > 0) {
      files.sort((a, b) => {
        const indexA = trackOrder.indexOf(a.filename);
        const indexB = trackOrder.indexOf(b.filename);
        
        // If both in order list, sort by order
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        // If only one in order list, prioritize it
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        // If neither in order list, sort by date
        return b.date.localeCompare(a.date);
      });
    } else {
      // Fallback: sort by date modified (newest first)
      files.sort((a, b) => b.date.localeCompare(a.date));
    }

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error reading audio directory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

