/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
