"use client";

import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { useRouter } from "next/navigation";

import { siteConfig } from "@/config/site";
import { title } from "@/components/primitives";

export default function Home() {
  const router = useRouter();

  return (
    <section className="flex flex-col items-center justify-center gap-6 py-12 md:py-16">
      <div className="text-center">
        <h1 className={title({ size: 'lg' })}>I&apos;m ...</h1>
        <Divider className="my-4" />
        <div className="flex h-5 items-center space-x-4 text-small">
          <Button
            color="primary"
            variant="ghost"
            size="lg"
            onPress={() => router.push(siteConfig.navItems[0].href)}
          >
            Sender
          </Button>
          <Divider orientation="vertical" />
          <Button
            color="secondary"
            variant="ghost"
            size="lg"
            onPress={() => router.push(siteConfig.navItems[1].href)}
          >
            Receiver
          </Button>
        </div>
      </div>
    </section>
  );
}
