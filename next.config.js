/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
    reactStrictMode: true,
    output: 'export',
    basePath: '/qr-code-generator',
    assetPrefix: '/qr-code-generator/',
    trailingSlash: true,
    turbopack: {
        root: path.resolve(__dirname),
    },
}

module.exports = nextConfig
