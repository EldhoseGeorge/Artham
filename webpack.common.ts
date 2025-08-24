import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";
import webpack from "webpack";

const config: webpack.Configuration = {
  entry: {
    background: "./background.ts",
    content: "./content.ts",
    popup: "./popup.ts",
    stemmer: "./stemmer.ts",
    style: "./style.ts",
    fav: "./fav.ts",
    popup_meaning: "./popup_meaning.ts",
  },
  context: path.join(__dirname, "src"),
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
