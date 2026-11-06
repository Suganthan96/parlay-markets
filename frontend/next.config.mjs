/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { typedRoutes: false },
  webpack(config) {
    // @coinbase/cdp-sdk has optional x402 peer deps that aren't installed.
    // Stub them out so the build doesn't fail — they're only used by the
    // Coinbase Base Account connector, which we don't use.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/evm/upto/client':  false,
      '@x402/evm/exact/client': false,
      '@x402/core/client':      false,
    };
    return config;
  },
};
export default nextConfig;
