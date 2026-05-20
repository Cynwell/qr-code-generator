import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import NextLink from "next/link";

import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";

export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center justify-center">
        <h1 className={title()}>I&apos;m ...</h1>
        <Divider className="my-4" />
        <div className="flex h-5 items-center space-x-4 text-small">
          <NextLink href={siteConfig.navItems[0].href} passHref legacyBehavior>
            <Button
              as="a"
              color="primary"
              variant="ghost"
              size="lg"
            >
              Sender
            </Button>
          </NextLink>
          <Divider orientation="vertical" />
          <NextLink href={siteConfig.navItems[1].href} passHref legacyBehavior>
            <Button
              as="a"
              color="secondary"
              variant="ghost"
              size="lg"
            >
              Receiver
            </Button>
          </NextLink>
        </div>
      </div>
    </section>
  );
}
