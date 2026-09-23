import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Podcast House | Studio time clock",
  description: "Secure studio clock-in and timesheets for Podcast House.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
