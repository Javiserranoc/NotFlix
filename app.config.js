// BASE_PATH es la subruta donde se publica la app (/NotFlix en GitHub Pages).
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.BASE_PATH || undefined },
});
