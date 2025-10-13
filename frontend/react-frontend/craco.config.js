const { addBeforeLoader, loaderByName } = require('@craco/craco');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Find the PostCSS loader and modify its configuration
      const postcssLoader = webpackConfig.module.rules
        .find(rule => rule.oneOf)
        ?.oneOf?.find(rule => 
          rule.use && 
          rule.use.some(loader => 
            loader.loader && loader.loader.includes('postcss-loader')
          )
        );

      if (postcssLoader) {
        const postcssLoaderConfig = postcssLoader.use.find(loader => 
          loader.loader && loader.loader.includes('postcss-loader')
        );

        if (postcssLoaderConfig && postcssLoaderConfig.options) {
          // Override the PostCSS plugins to use @tailwindcss/postcss instead of tailwindcss
          postcssLoaderConfig.options.postcssOptions = {
            plugins: [
              require('@tailwindcss/postcss'),
              require('autoprefixer'),
            ],
          };
        }
      }

      return webpackConfig;
    },
  },
};
