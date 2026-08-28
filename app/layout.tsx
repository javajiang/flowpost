import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowPost",
  description: "Create and distribute content in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
