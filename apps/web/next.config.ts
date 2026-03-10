import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@talkform/core", "@talkform/http", "@talkform/react"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://api.openai.com; media-src 'self' blob:; frame-src 'self' https://share.synthesia.io https://*.synthesia.io https://*.heygen.com; child-src 'self' https://share.synthesia.io https://*.synthesia.io https://*.heygen.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
