import type { Metadata } from "next";
import { appConfig } from "../lib/catalog";
import "./globals.css";
export const metadata: Metadata = {
  title: appConfig.title,
  description: "Build a shared name shortlist with independent ratings, pair comparisons, and a final tournament.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
