import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify preview URLs exist at build time but are not all present in Functions.
  // Embed only public origins, never secrets or arbitrary environment values.
  env: {
    PH_BUILD_ORIGINS: JSON.stringify(
      [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL].filter(Boolean)
    ),
  },
};

export default nextConfig;
