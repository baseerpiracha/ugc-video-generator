import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UGC Video Generator',
  description: 'Paste a product URL and turn it into a UGC-style marketing video.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
