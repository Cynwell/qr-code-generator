# QR Code Data Transfer

A web application for transferring arbitrary data (text, files, code) between devices using animated QR codes. The sender encodes data into a sequence of QR codes displayed as an animation; the receiver scans them with a camera to reconstruct the original data — no network connection required.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router, static export)
- **Language**: [TypeScript](https://www.typescriptlang.org/) 6
- **UI Library**: [React](https://react.dev/) 19
- **Component Library**: [HeroUI](https://heroui.com/) (buttons, sliders, inputs, navbar)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 4
- **QR Encoding**: [qrcode](https://www.npmjs.com/package/qrcode) (canvas rendering)
- **QR Decoding**: [jsQR](https://www.npmjs.com/package/jsqr) + [BarcodeDetector API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
- **FEC**: Systematic LT codes (fountain codes) for forward error correction
- **Compression**: Built-in CompressionStream API (gzip/deflate)

## Features

- **Unlimited data length**: Segments data into fountain-coded QR frames
- **File & text transfer**: Supports arbitrary files and text (including unicode, tabs, special characters)
- **Forward error correction**: Systematic LT codes allow reconstruction from any sufficient subset of frames — no need for sequential scanning
- **Transfer profiles**: XS / Small / Medium / Large presets optimized for different camera capabilities
- **Integrity verification**: SHA-256 hash check on reconstructed data
- **Static export**: Deploys to any static hosting (GitHub Pages, Vercel, Netlify)
- **Offline-capable**: No server required after initial page load

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ 
- [pnpm](https://pnpm.io/) 10+

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Cynwell/qr-code-generator.git
cd qr-code-generator

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

## Build & Serve Locally

```bash
# Build static files
pnpm build

# Serve the static output
npx serve out
```

The static site will be served at `http://localhost:3000`.

### Build for Subpath Deployment

For deploying to a subpath (e.g., `https://username.github.io/qr-code-generator/`):

```bash
NEXT_PUBLIC_BASE_PATH=/qr-code-generator pnpm build
```

## Project Structure

```
app/                  # Next.js App Router pages
  sender/             # Sender page (encode & display QR codes)
  receiver/           # Receiver page (scan & reconstruct data)
components/           # React components
  sender/             # Sender-specific components (QrTransmitter, stats)
  receiver/           # Receiver-specific components (stats)
config/               # Site configuration
utils/                # Core logic
  protocol/           # Binary frame codec, CRC32C, hashing
  fec/                # Fountain code encoder/decoder (LT codes)
  sender/             # Transfer session builder, compression
  receiver/           # Receiver session, scanner backends, ROI tracker
styles/               # Global CSS
types/                # TypeScript type definitions
public/               # Static assets
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

See [LICENSE](LICENSE) for details.

## Screenshots

![Landing page](demo-landing-page.png)
![Sender page](demo-sender-page.png)
![Sender page with QR code](demo-sender-page-qr-code.png)
![Receiver page](demo-receiver-page.png)
![Receiver page download](demo-receiver-page-download-file.png)