import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Next To-Do',
  description: 'A tiny, professional To-Do app built with Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        background: 'radial-gradient(1200px 800px at 20% 0%, #0f1324 0%, #080a0f 40%, #000000 100%)',
        color: '#eef1f8'
      }}>
        <main style={{ minHeight: '100svh', display: 'grid', placeItems: 'center' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
