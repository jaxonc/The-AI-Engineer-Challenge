/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Request body size limit (Vercel's platform limit is 4.5MB)
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
  // Configure server-side settings for file uploads
  serverRuntimeConfig: {
    // Max file size for uploads (4.5MB - Vercel's limit)
    maxFileSize: 4.5 * 1024 * 1024,
  },
  // Configure public runtime config
  publicRuntimeConfig: {
    // Max file size for client-side validation (4.5MB - Vercel's limit)
    maxFileSize: 4.5 * 1024 * 1024,
  },
}

module.exports = nextConfig 