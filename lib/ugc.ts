import { z } from 'zod';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { put } from '@vercel/blob';

const ffmpegPath = (() => {
  try {
    const binary = require('ffmpeg-static');
    if (binary && typeof binary === 'string' && fs.existsSync(binary)) {
      return binary;
    }
  } catch {
    // fall through to a local binary lookup below
  }

  const localBinary = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  const fallback = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  return fallback;
})();

const productInsightSchema = z.object({
  productName: z.string().default('Product'),
  category: z.string().default('tech'),
  audience: z.string().default('Early adopters'),
  valueProp: z.string().default('A better way to get things done.'),
  keywords: z.array(z.string()).default([]),
  tone: z.string().default('confident and modern'),
  hook: z.string().default('POV: it finally clicks.'),
  script: z.array(z.string()).default(['This is the product you didn’t know you needed.']),
  backgroundAsset: z.string().default('bg-ugc-motion'),
  gifAsset: z.string().default('gif-ugc-accent'),
  audioAsset: z.string().default('audio-ugc-beat'),
  duration: z.number().min(5).max(10).default(8),
  productImagePath: z.string().default(''),
});

const assetCatalog = {
  tech: { bg: ['bg-ugc-motion'], gif: ['gif-ugc-accent'], audio: ['audio-ugc-beat'] },
  fitness: { bg: ['bg-fitness-1'], gif: ['gif-workout', 'gif-yes'], audio: ['audio-uptempo'] },
  food: { bg: ['bg-food-1'], gif: ['gif-chef', 'gif-yum'], audio: ['audio-bouncy'] },
  productivity: { bg: ['bg-work-1'], gif: ['gif-focus', 'gif-idea'], audio: ['audio-productive'] },
  lifestyle: { bg: ['bg-lifestyle-1'], gif: ['gif-glow', 'gif-bounce'], audio: ['audio-casual'] },
};

export function extractUrlFromMessage(message: string) {
  const match = message.match(/https?:\/\/[^\s)\]>"']+/i);
  return match ? match[0].replace(/[),.;]+$/, '') : null;
}

export async function fetchWebsiteContent(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UGCVideoBot/1.0; +https://example.com)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').first().text() || 'Product';
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4000);
    const imageUrl = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '';
    let productImagePath = '';

    if (imageUrl) {
      try {
        const imageResponse = await fetch(new URL(imageUrl, url).toString(), { signal: AbortSignal.timeout(8000) });
        const contentType = imageResponse.headers.get('content-type') || '';
        if (imageResponse.ok && contentType.startsWith('image/')) {
          const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
          const imageDirectory = path.join(process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), 'public', 'generated'), 'product-images');
          fs.mkdirSync(imageDirectory, { recursive: true });
          productImagePath = path.join(imageDirectory, `product-${Buffer.from(url.hostname).toString('hex').slice(0, 16)}.${extension}`);
          fs.writeFileSync(productImagePath, Buffer.from(await imageResponse.arrayBuffer()));
        }
      } catch {
        productImagePath = '';
      }
    }

    return { url: url.toString(), title, description, text, domain: url.hostname, productImagePath };
  } catch {
    const url = new URL(rawUrl);
    return {
      url: rawUrl,
      title: 'Public product page',
      description: 'Could not fully scrape the site, but a product concept will still be generated from the URL and available metadata.',
      text: '',
      domain: url.hostname,
      productImagePath: '',
      fallback: true,
    };
  }
}

export async function analyzeProduct(siteData: {
  url: string;
  title: string;
  description: string;
  text: string;
  domain: string;
  productImagePath?: string;
  fallback?: boolean;
}) {
  const rawContent = [siteData.title, siteData.description, siteData.text].filter(Boolean).join(' ');
  const inferredName = siteData.title.replace(/\s*[-|–].*$/, '').trim() || 'Product';
  const category = detectCategory(rawContent, siteData.domain, siteData.title);
  const valueProp = siteData.description || 'A modern product that helps people move faster and feel more confident.';
  const audience = detectAudience(category);
  const keywordHints = Array.from(new Set(rawContent.toLowerCase().match(/[a-z][a-z0-9+.-]{2,}/g) || [])).slice(0, 8);

  return {
    productName: inferredName || 'Product',
    category,
    audience,
    valueProp,
    keywords: keywordHints,
    tone: 'confident, modern, creator-led',
    hook: buildHook(category, inferredName),
    script: buildScript(inferredName, category, valueProp),
    backgroundAsset: pickBackground(category),
    gifAsset: pickGif(category),
    audioAsset: 'audio-ugc-beat',
    duration: 8,
    productImagePath: siteData.productImagePath || '',
  };
}

export async function generateCreative(product: { [key: string]: any }) {
  const normalized = productInsightSchema.parse(product);
  return {
    ...normalized,
    script: normalized.script.slice(0, 3),
    backgroundAsset: chooseAvailableAsset(normalized.backgroundAsset, 'background'),
    gifAsset: chooseAvailableAsset(normalized.gifAsset, 'gif'),
    audioAsset: chooseAvailableAsset(normalized.audioAsset, 'audio'),
  };
}

function detectCategory(text: string, domain: string, title: string) {
  const haystack = `${text} ${title} ${domain}`.toLowerCase();
  if (/(fitness|workout|gym|health|calorie|nutrition|meal)/i.test(haystack)) return 'fitness';
  if (/(food|recipe|meal|restaurant|cuisine|kitchen)/i.test(haystack)) return 'food';
  if (/(productivity|workflow|notes|task|team|business|crm|email)/i.test(haystack)) return 'productivity';
  if (/(lifestyle|fashion|travel|wellness|community)/i.test(haystack)) return 'lifestyle';
  if (/(ai|saas|software|platform|app|startup|automate|tools)/i.test(haystack)) return 'tech';
  return 'tech';
}

function detectAudience(category: string) {
  switch (category) {
    case 'fitness':
      return 'busy people who want a better routine';
    case 'food':
      return 'people who want better meal decisions';
    case 'productivity':
      return 'founders and professionals who need clarity';
    case 'lifestyle':
      return 'modern lifestyle shoppers';
    default:
      return 'people who want a smarter digital routine';
  }
}

function buildHook(category: string, name: string) {
  if (category === 'fitness') return 'POV: you finally stop guessing your routine.';
  if (category === 'food') return 'POV: dinner just got way easier.';
  if (category === 'productivity') return 'POV: your workflow finally feels effortless.';
  return `POV: ${name} solves the part of your day you keep putting off.`;
}

function buildScript(name: string, category: string, valueProp: string) {
  if (category === 'fitness') {
    return ['POV: you finally stop guessing your calories', 'Just snap your meal', 'CalAI does the rest.'];
  }
  if (category === 'food') {
    return ['POV: your meal plan just got smarter', 'No more endless scrolling', 'Your next favorite dish is already waiting.'];
  }
  return [`POV: you finally try ${name}.`, `It turns ${valueProp.toLowerCase()}.`, 'This is the kind of product people keep sending to friends.'];
}

function pickBackground(category: string) {
  return assetCatalog[category as keyof typeof assetCatalog]?.bg[0] ?? assetCatalog.tech.bg[0];
}

function pickGif(category: string) {
  return assetCatalog[category as keyof typeof assetCatalog]?.gif[0] ?? assetCatalog.tech.gif[0];
}

function chooseAvailableAsset(chosen: string, kind: 'background' | 'gif' | 'audio') {
  const all = Object.values(assetCatalog).flatMap((group: any) => {
    if (kind === 'background') return group.bg;
    if (kind === 'gif') return group.gif;
    return group.audio;
  });
  return all.includes(chosen) ? chosen : all[0];
}

async function ensureAssetLibrary() {
  const base = path.join(process.cwd(), 'public', 'assets');
  const folders = {
    backgrounds: path.join(base, 'backgrounds'),
    gifs: path.join(base, 'gifs'),
    audio: path.join(base, 'audio'),
  };
  Object.values(folders).forEach((folder) => fs.mkdirSync(folder, { recursive: true }));

  const ffmpeg = ffmpegPath || 'ffmpeg';
  const bgFile = path.join(folders.backgrounds, 'bg-ugc-motion.mp4');
  const gifFile = path.join(folders.gifs, 'gif-ugc-accent.gif');
  const audioFile = path.join(folders.audio, 'audio-ugc-beat.mp3');

  const needsRebuild = (file: string, minimumBytes = 1024) => !fs.existsSync(file) || fs.statSync(file).size < minimumBytes;

  if (needsRebuild(bgFile, 50000)) {
    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpeg,
        ['-y', '-f', 'lavfi', '-i', 'color=c=#111827:s=1080x1920:d=8', '-vf', "drawbox=x='(w-460)*abs(sin(t/2))':y=150:w=460:h=460:color=0x7c3aed@0.42:t=fill,drawbox=x='(w-340)*abs(cos(t/1.7))':y=1120:w=340:h=340:color=0xf97316@0.5:t=fill,noise=alls=8:allf=t+u,format=yuv420p", '-t', '8', bgFile],
        (error) => (error ? reject(error) : resolve())
      );
    });
  }

  if (needsRebuild(gifFile, 12000)) {
    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpeg,
        [
          '-y',
          '-f', 'lavfi',
          '-i', 'color=c=#f97316:s=600x600:d=1',
          '-vf', "fps=12,drawbox=x='120+90*sin(t*6)':y='120+80*cos(t*6)':w=260:h=260:color=white@0.95:t=fill,drawbox=x='180+70*cos(t*6)':y='190+70*sin(t*6)':w=120:h=120:color=0x7c3aed@0.9:t=fill,scale=600:600:flags=lanczos,split[s0][s1];[s1]palettegen=stats_mode=diff[p];[s0][p]paletteuse",
          '-loop', '0',
          gifFile,
        ],
        (error) => (error ? reject(error) : resolve())
      );
    });
  }

  if (needsRebuild(audioFile, 50000)) {
    await new Promise<void>((resolve, reject) => {
      execFile(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'aevalsrc=0.12*sin(2*PI*110*t)+0.06*sin(2*PI*220*t)+0.03*sin(2*PI*880*t):s=44100:d=8', '-ar', '44100', '-c:a', 'mp3', audioFile], (error) => (error ? reject(error) : resolve()));
    });
  }
}

function escapeFilterText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function renderVideo(creative: {
  productName: string;
  hook: string;
  script: string[];
  backgroundAsset: string;
  gifAsset: string;
  audioAsset: string;
  duration: number;
  productImagePath?: string;
}) {
  await ensureAssetLibrary();

  const safeName = creative.productName.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'ugc-video';
  const outputDir = process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), 'public', 'generated');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${safeName}-${Date.now()}.mp4`);
  const bgPath = path.join(process.cwd(), 'public', 'assets', 'backgrounds', `${creative.backgroundAsset}.mp4`);
  const gifPath = path.join(process.cwd(), 'public', 'assets', 'gifs', `${creative.gifAsset}.gif`);
  const audioPath = path.join(process.cwd(), 'public', 'assets', 'audio', `${creative.audioAsset}.mp3`);

  const availableBg = fs.existsSync(bgPath) ? bgPath : path.join(process.cwd(), 'public', 'assets', 'backgrounds', 'bg-ugc-motion.mp4');
  const availableGif = fs.existsSync(gifPath) ? gifPath : path.join(process.cwd(), 'public', 'assets', 'gifs', 'gif-ugc-accent.gif');
  const availableAudio = fs.existsSync(audioPath) ? audioPath : path.join(process.cwd(), 'public', 'assets', 'audio', 'audio-ugc-beat.mp3');
  const productImagePath = creative.productImagePath && fs.existsSync(creative.productImagePath) ? creative.productImagePath : '';

  const ffmpeg = ffmpegPath || 'ffmpeg';
  const hookText = escapeFilterText(creative.hook);
  const subtitleText = escapeFilterText(creative.script[1] || 'This is the moment.');
  const productText = escapeFilterText(creative.productName);

  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpeg,
      [
        '-y',
        '-stream_loop', '-1',
        '-i', availableBg,
        '-stream_loop', '-1',
        '-i', availableGif,
        '-stream_loop', '-1',
        '-i', availableAudio,
        ...(productImagePath ? ['-loop', '1', '-i', productImagePath] : []),
        '-filter_complex',
        `${productImagePath ? `[0:v]scale=1080:1920,setsar=1[base];[3:v]scale=760:560:force_original_aspect_ratio=decrease,setsar=1[product];[base][product]overlay=(W-w)/2:760:enable='between(t,0,${creative.duration})'[bg]` : '[0:v]scale=1080:1920,setsar=1[bg]'};[1:v]scale=280:280,format=rgba,setsar=1[gif];[bg][gif]overlay=W-w-70:330:enable='between(t,0.5,${creative.duration})'[v];[v]drawtext=text='${hookText}':fontcolor=white:fontsize=62:box=1:boxcolor=0x11182799:boxborderw=18:x=(w-text_w)/2:y=h*0.18:enable='between(t,0.5,3.5)'` +
          `,drawtext=text='${subtitleText}':fontcolor=white:fontsize=46:box=1:boxcolor=0x11182799:boxborderw=16:x=(w-text_w)/2:y=h*0.84:enable='between(t,2.0,7.5)'` +
          `,drawtext=text='${productText}':fontcolor=0xf9a8d4:fontsize=34:box=1:boxcolor=0x11182799:boxborderw=14:x=(w-text_w)/2:y=h*0.92:enable='between(t,3.5,8.5)'[outv]`,
        '-map', '[outv]',
        '-map', '2:a',
        '-t', String(creative.duration),
        '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264',
        outputPath,
      ],
      (error, stdout, stderr) => {
        if (error) {
          console.error(stderr || stdout || error.message);
          return reject(error);
        }
        resolve();
      }
    );
  });

  if (process.env.VERCEL) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required for Vercel video storage.');
    }

    const blob = await put(`ugc-videos/${path.basename(outputPath)}`, fs.readFileSync(outputPath), {
      access: 'public',
      addRandomSuffix: false,
    });
    return blob.url;
  }

  return `/api/video/${path.basename(outputPath)}`;
}
