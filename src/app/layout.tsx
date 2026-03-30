import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "featuredocs",
  description: "Versioned product feature documentation with i18n",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#FAF9F6] text-[#1A1A1A]">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[#E8E6E1] py-6">
          <div className="mx-auto max-w-4xl px-6">
            <p className="text-center text-xs text-[#B0B0B0]">
              featuredocs — versioned product documentation
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
