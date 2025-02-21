import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js",
          dest: "./",
        },
        {
          src: "node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx",
          dest: "./",
        },
        {
          src: "node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx",
          dest: "./",
        },
        {
          src: "node_modules/onnxruntime-web/dist/*.wasm",
          dest: "./",
        },
      ],
    }),
    react(),
  ],
});
