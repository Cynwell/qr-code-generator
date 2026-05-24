import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import { Link } from "@heroui/link";
import clsx from "clsx";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: `${basePath}/qr-code-icon.svg`,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  width: "device-width",
  userScalable: false,
  minimumScale: 1.0,
  maximumScale: 1.0,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <div className="relative flex flex-col h-screen">
            <Navbar />
            <main className="mx-auto w-full pt-4 px-4 sm:px-6 lg:px-8 2xl:px-12 flex-grow">
              {children}
            </main>
            <footer className="w-full flex items-center justify-center py-3">
              {/* <TODO>This part will have a link to settings later on, probably</TODO> */}
              <Link
                isExternal
                className="flex items-center gap-1 text-current"
                href="https://github.com/cynwell"
                title="Cynwell GitHub Homepage"
              >
                <span className="text-default-600">Made by</span>
                <p className="text-primary">Cynwell :)</p>
              </Link>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
