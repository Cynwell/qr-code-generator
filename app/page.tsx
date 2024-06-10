import { Link } from "@nextui-org/link";
import { Snippet } from "@nextui-org/snippet";
import { Code } from "@nextui-org/code";
import { button as buttonStyles } from "@nextui-org/theme";
import { Divider } from "@nextui-org/divider";
import { Button } from "@nextui-org/react";

import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";

export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center justify-center">
        <h1 className={title()}>I'm ...</h1>
        <Divider className="my-4" />
        <div className="flex h-5 items-center space-x-4 text-small">
          <Link
            className={buttonStyles({
              color: "primary",
              variant: "ghost",
              size: "lg",
            })}
            href={siteConfig.navItems[0].href}
          >
            Sender
          </Link>
          <Divider orientation="vertical" />
          <Link
            className={buttonStyles({
              color: "secondary",
              variant: "ghost",
              size: "lg",
            })}
            href={siteConfig.navItems[1].href}
          >
            Receiver
          </Link>
        </div>
      </div>
    </section>
  );
}
