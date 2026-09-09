/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  basePath: process.env.GITHUB_ACTIONS ? '/ugc-video-generator' : '',
  assetPrefix: process.env.GITHUB_ACTIONS ? '/ugc-video-generator/' : '',
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
    },
    outputFileTracingIncludes: {
      '/*': [
        './node_modules/ffmpeg-static/ffmpeg',
        './node_modules/ffmpeg-static/ffmpeg.exe',
      ],
    },
  },
};

export default nextConfig;
