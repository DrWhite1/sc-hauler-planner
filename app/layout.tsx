import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SC Hauler Planner",
  description: "Plan optimal Star Citizen hauler missions and routes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-accent">
        {children}
      </body>
    </html>
  );
}