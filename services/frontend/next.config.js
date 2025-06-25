/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    // Use backend service name when running in Docker
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'http://backend:3001'
      : (process.env.REACT_APP_API_URL || 'http://localhost:3001');
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`
      }
    ];
  }
};

module.exports = nextConfig;