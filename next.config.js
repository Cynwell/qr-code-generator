/** @type {import('next').NextConfig} */
const path = require('path')

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig = {
    reactStrictMode: true,
    output: 'export',
    trailingSlash: true,
    turbopack: {
        root: path.resolve(__dirname),
    },
}

if (basePath) {
    nextConfig.basePath = basePath
}

module.exports = nextConfig
