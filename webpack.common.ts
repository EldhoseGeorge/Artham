import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";
import webpack from "webpack";

const config: webpack.Configuration = {
  entry: {
    background: path.resolve(__dirname, "src/background.ts"),
    content: path.resolve(__dirname, "src/content.ts"),
    popup: path.resolve(__dirname, "src/popup.ts"),
    stemmer: path.resolve(__dirname, "src/stemmer.ts"),
    style: path.resolve(__dirname, "src/style.ts"),
    fav: path.resolve(__dirname, "src/fav.ts"),
    popup_meaning: path.resolve(__dirname, "src/popup_meaning.ts"),
  },

  resolve: {
    extensions: [".ts"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    clean: true, // Clean the output directory before emit.
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, "static") }],
    }),
  ],
};

export default config;
