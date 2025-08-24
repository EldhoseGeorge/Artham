import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";
import webpack from "webpack";
const srcDir = path.resolve(__dirname, "src");
const config: webpack.Configuration = {
  entry: {
    background: path.join(srcDir, "background.ts"),
    content: path.join(srcDir, "content.ts"),
    popup: path.join(srcDir, "popup.ts"),
    stemmer: path.join(srcDir, "stemmer.ts"),
    style: path.join(srcDir, "style.ts"),
    fav: path.join(srcDir, "fav.ts"),
    popup_meaning: path.join(srcDir, "popup_meaning.ts"),
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
      patterns: [{ from: "static" }],
    }),
  ],
};

export default config;
