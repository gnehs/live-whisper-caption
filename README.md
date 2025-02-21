# Live Whisper Caption

Near real-time speech-to-text transcription powered by Whisper and Voice Activity Detection (VAD).

## Features

- 🎙️ Near real-time speech recognition
- 🔍 Accurate voice activity detection
- 🚀 Fast transcription with WebGPU acceleration
- 💻 Runs entirely in the browser
- 🌐 No server required

## Technical Stack

- Voice Activity Detection powered by [@ricky0123/vad-web](https://github.com/ricky0123/vad)
- Speech recognition using [Whisper Large V3 Turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo/)
- WebGPU acceleration with [Transformers.js](https://github.com/huggingface/transformers.js)

## Requirements

- A modern browser with WebGPU support (Chrome/Edge/Safari)
- Approximately 2GB of storage space for the model
- A microphone

## License

MIT
