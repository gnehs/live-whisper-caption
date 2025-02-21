import { pipeline } from "@huggingface/transformers";
/**
 * This class uses the Singleton pattern to ensure that only one instance of the model is loaded.
 */
class PipelineSingeton {
  static asr_model_id = "onnx-community/whisper-large-v3-turbo";
  static asr_instance = null;

  static async getInstance(progress_callback = null) {
    this.asr_instance ??= pipeline(
      "automatic-speech-recognition",
      this.asr_model_id,
      {
        dtype: {
          encoder_model: "fp16",
          decoder_model_merged: "q4",
        },
        device: "webgpu",
        progress_callback,
      },
    );
    return this.asr_instance;
  }
}

async function load() {
  self.postMessage({
    status: "loading",
    data: `Loading models...`,
  });

  // Load the pipeline and save it for future use.
  const [transcriber, segmentation_processor, segmentation_model] =
    await PipelineSingeton.getInstance((x) => {
      // We also add a progress callback to the pipeline so that we can
      // track model loading.
      self.postMessage(x);
    }, "webgpu");

  self.postMessage({
    status: "loading",
    data: "Compiling shaders and warming up model...",
  });

  await transcriber(new Float32Array(16_000), {
    language: "en",
  });

  self.postMessage({ status: "loaded" });
}

async function run({ audio, language = "chinese" }) {
  const transcriber = await PipelineSingeton.getInstance();

  const { text } = await transcriber(audio, {
    language,
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 10,
  });

  self.postMessage({
    status: "vad_done",
    data: { text },
  });
}

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "load":
      load(data);
      break;

    case "run":
      run(data);
      break;
  }
});
