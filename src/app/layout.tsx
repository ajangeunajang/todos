import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  other: {
    "format-detection": "telephone=no, date=no, email=no, address=no",
  },
  metadataBase: new URL("https://merge-todos.vercel.app"),
  title: "極大粒シャインマスカット",
  description: "today's todos",
  openGraph: {
    title: "極大粒シャインマスカット",
    description: "today's todos",
    url: "https://merge-todos.vercel.app",
    images: [{ url: "/og.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "極大粒シャインマスカット",
    description: "today's todos",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col font-mono ${ibmPlexMono.variable}`} style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{children}</body>
    </html>
  );
}
