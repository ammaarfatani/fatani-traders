
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    const backendUrl = (
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:5000'
    ).replace(/\/api\/?$/, '').replace(/\/$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
