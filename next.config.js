module.exports = {
    webpack(config) {
      config.module.rules.push({
        test: /\.svg$/,
        use: ["@svgr/webpack"]
      });
  
      return config;
    },
    eslint: {
      // Warning: This allows production builds to successfully complete
      // even if ESLint errors are present.
      ignoreDuringBuilds: true,
    },
    experimental: {
      // Include print snapshots in serverless QR/practice routes, even when the
      // ignored local book-builder volumes do not exist during deployment.
      outputFileTracingIncludes: {
        "/q/*": ["./data/published-books/**/*"],
        // Next 13 caches each include glob's relative paths: use a distinct
        // spelling for these deeper routes so their bundle paths stay correct.
        "/api/book-pages/*": ["data/published-books/**/*"],
        "/api/book-practice/*": ["data/published-books/**/*"],
        "/api/book-builder": ["./data/published-books/**/*"],
      },
    },
    productionBrowserSourceMaps: true
  };