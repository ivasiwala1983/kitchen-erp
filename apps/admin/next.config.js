/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@kitchen-erp/types',
    '@kitchen-erp/utils',
    '@kitchen-erp/api-client',
    '@kitchen-erp/ui',
  ],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
