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
    productionBrowserSourceMaps: true
  };