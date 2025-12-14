import path from 'path';
import { defineConfig } from '@rspack/cli';
import HtmlRspackPlugin from '@rspack/plugin-html';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  context: __dirname,
  entry: {
    main: './src/main.tsx'
  },
  mode: isDev ? 'development' : 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@browser-playground/core': path.resolve(__dirname, '../core/src'),
      '@browser-playground/plugin-controller': path.resolve(__dirname, '../../plugins/plugin-controller/src'),
      '@browser-playground/plugin-vue': path.resolve(__dirname, '../../plugins/plugin-vue/src')
    }
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: { syntax: 'typescript', tsx: true },
                transform: { react: { runtime: 'automatic', refresh: false } }
              }
            }
          }
        ]
      },
      {
        test: /\.d\.ts$/i,
        type: 'asset/source'
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlRspackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
      title: 'Browser Playground'
    })
  ],
  devServer: {
    hot: true,
    port: 3000,
    static: {
      directory: path.resolve(__dirname, 'public')
    }
  }
});
