import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://fake-headline-predictor.vercel.app"),
  title: "Three Headlines and a Lie Machine Learning Challenge",
  description:
    "Can you spot the fake headline? Play Three Headlines and a Lie and see how your judgement compares with machine learning models.",
  openGraph: {
    title: "Three Headlines and a Lie Machine Learning Challenge",
    description:
      "Can you spot the fake headline? Play the game and compare your score with machine learning models.",
    url: "https://fake-headline-predictor.vercel.app",
    siteName: "Three Headlines and a Lie",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
