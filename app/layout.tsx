import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ObserveX SaaS",
  description: "Premium SaaS log intelligence platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="fixed inset-0 opacity-[0.08] grid-bg pointer-events-none" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
