/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  // 开发环境代理配置
  dev: {
    // localhost:8001/api/** -> http://localhost:3010/api/**
    '/api/': {
      target: 'http://localhost:3010',
      changeOrigin: true,
      secure: false,
    },
  },
  /**
   * @name 详细的代理配置
   * @doc https://github.com/chimurai/http-proxy-middleware
   */
  test: {
    '/api/': {
      target: 'http://localhost:3010',
      changeOrigin: true,
      secure: false,
    },
  },
  pre: {
    '/api/': {
      target: 'http://localhost:3010',
      changeOrigin: true,
      secure: false,
    },
  },
};
