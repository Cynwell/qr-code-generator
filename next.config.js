/** @type {import('next').NextConfig} */
const path = require('path')

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig = {
    reactStrictMode: true,
    output: 'export',
    // basePath: /qr-code-generator,
    // assetPrefix: /qr-code-generator,
    trailingSlash: true,
    turbopack: {
        root: path.resolve(__dirname),
    },
}

if (basePath) {
    nextConfig.basePath = basePath
    nextConfig.assetPrefix = basePath
}

module.exports = nextConfig
