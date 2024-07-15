export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "QR Code Generator",
  description: "Generates QR Code for anything! The only limit is your imagination!",
  navItems: [
    {
      label: "Sender",
      href: "sender",
    },
    {
      label: "Receiver",
      href: "receiver",
    },
  ],
  links: {
    github: "https://github.com/cynwell",
  },
};
