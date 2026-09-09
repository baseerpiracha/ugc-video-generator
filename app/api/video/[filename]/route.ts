import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { filename: string } }) {
  const filename = path.basename(params.filename);
  if (!filename.endsWith('.mp4')) {
    return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'public', 'generated', filename);

  try {
    const file = await fs.readFile(filePath);
    const range = request.headers.get('range');
    const headers = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    };

    if (!range) {
      return new NextResponse(file, { headers: { ...headers, 'Content-Length': String(file.length) } });
    }

    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new NextResponse(file, { headers: { ...headers, 'Content-Length': String(file.length) } });
    }

    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : file.length - 1;
    const end = Math.min(requestedEnd, file.length - 1);
    if (start >= file.length || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${file.length}` },
      });
    }

    const chunk = file.subarray(start, end + 1);
    return new NextResponse(chunk, {
      status: 206,
      headers: {
        ...headers,
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end}/${file.length}`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  }
}
