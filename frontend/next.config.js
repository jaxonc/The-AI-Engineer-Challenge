/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow larger request bodies for file uploads
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  // Configure server-side settings for file uploads
  serverRuntimeConfig: {
    // Max file size for uploads (10MB)
    maxFileSize: 10 * 1024 * 1024,
  },
  // Configure public runtime config
  publicRuntimeConfig: {
    // Max file size for client-side validation
    maxFileSize: 10 * 1024 * 1024,
  },
}

module.exports = nextConfig 