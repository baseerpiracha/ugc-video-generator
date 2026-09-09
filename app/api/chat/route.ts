import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractUrlFromMessage, fetchWebsiteContent, analyzeProduct, generateCreative, renderVideo } from '@/lib/ugc';

export const maxDuration = 60;

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Please send a valid message.' }, { status: 400 });
    }

    const message = parsed.data.message;
    const detectedUrl = extractUrlFromMessage(message);

    if (!detectedUrl) {
      const normalizedMessage = message.toLowerCase();
      if (/\b(hi|hello|hey|good morning|good afternoon)\b/.test(normalizedMessage)) {
        return NextResponse.json({
          reply: 'Hey! Send me a product URL and I’ll turn it into a short UGC marketing video.',
        });
      }

      if (/(what can you do|how does this work|help)/i.test(normalizedMessage)) {
        return NextResponse.json({
          reply: 'I can generate UGC videos for you. Send me a product URL and I’ll read the page, choose the assets, and assemble a short marketing video in this chat.',
        });
      }

      return NextResponse.json({
        reply: 'I can create a short UGC-style marketing video from a product URL. Paste one here and I’ll get started.',
      });
    }

    const siteData = await fetchWebsiteContent(detectedUrl);
    const productInsight = await analyzeProduct(siteData);
    const creative = await generateCreative(productInsight);
    const videoUrl = await renderVideo(creative);

    return NextResponse.json({
      reply: `I found ${productInsight.productName || 'your product'} and built a UGC concept for it. The video is ready.`,
      status: 'Video generated',
      videoUrl,
    });
  } catch (error) {
    console.error('chat api error', error);
    return NextResponse.json(
      {
        error: 'I could not generate a video for that URL. Please try a different public product page or a valid URL.',
        detail: process.env.NODE_ENV === 'production' && process.env.VERCEL ? String(error instanceof Error ? error.message : error) : undefined,
      },
      { status: 500 }
    );
  }
}
