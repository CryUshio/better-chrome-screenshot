const webpack = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const srcDir = path.join(__dirname, "..", "src");

/**
 * Webpack 通用配置
 * 包含入口点、输出配置、模块规则和插件设置
 * @type {import('webpack').Configuration}
 */
module.exports = {
  entry: {
    popup: path.join(srcDir, 'popup.tsx'),
    options: path.join(srcDir, 'options.tsx'),
    background: path.join(srcDir, 'background/index.ts'),
    content_script: path.join(srcDir, 'content_scripts/index.tsx'),
  },
  output: {
    path: path.join(__dirname, "../dist"),
    filename: "js/[name].js",
    clean: true,
  },
  optimization: {
    splitChunks: {
      name: "vendor",
      chunks(chunk) {
        return chunk.name !== 'background';
      }
    },
    minimize: false,
    minimizer: [],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          {
            loader: "css-loader",
            options: {
              importLoaders: 1,
            },
          },
          "postcss-loader"
        ],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{
        from: ".", to: ".", context: "public", globOptions: {
          // ignore: ['**/*.html']
        }
      }],
      options: {},
    }),
    // new HtmlWebpackPlugin({
    //   filename: 'popup.html',
    //   chunks: ['popup'],
    //   template: path.resolve(__dirname, '../public/popup.html')
    // }),
    // new HtmlWebpackPlugin({
    //   filename: 'options.html',
    //   chunks: ['options'],
    //   template: path.resolve(__dirname, '../public/options.html')
    // }),
    // new MiniCssExtractPlugin({
    //   filename: "css/[name].css",
    // }),
  ],
};
