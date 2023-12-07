const path = require('path');

module.exports = {
  mode: 'development', 
  entry: './src/public/js/index.ts', 
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.frontend.json'
            }
          },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }    
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'js/bundle.js',
    path: path.resolve(__dirname, 'dist', 'public'),
},
  devServer: {
    contentBase: './dist',
  },
};
