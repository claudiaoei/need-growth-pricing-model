import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth Pricing Framework — Need × HLI",
  description: "Interactive pricing model for Need × Hanwha Life Insurance cancer prevention partnership",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full bg-slate-950 text-white font-sans">{children}</body>
    </html>
  );
}
