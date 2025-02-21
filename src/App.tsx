import { motion, AnimatePresence } from "motion/react";
import { twMerge } from "tailwind-merge";
import {
  HardDriveDownload,
  Loader,
  Mic,
  MicOff,
  Play,
  Pause,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useMicVAD } from "@ricky0123/vad-react";
interface ProgressItem {
  file: string;
  loaded?: number;
  name: string;
  progress: number;
  total?: number;
}

//@ts-expect-error gpu is not supported in all browsers
const IS_WEBGPU_AVAILABLE = !!navigator.gpu;

function App() {
  const worker = useRef<Worker | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  const vad = useMicVAD({
    startOnLoad: false,
    positiveSpeechThreshold: 0.7,
    negativeSpeechThreshold: 0.65,
    redemptionFrames: 4,
    onSpeechEnd: (audio) => {
      processAudio(audio);
    },
  });

  const [status, setStatus] = useState(
    "您需要先下載語音辨識模型才能開始使用，會佔用約 2GB 的儲存空間",
  );
  const [downloaded, setDownloaded] = useLocalStorage("downloaded", false);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [audioQueue, setAudioQueue] = useState<Float32Array[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e: any) => {
      const message = e.data;
      switch (message.status) {
        case "initiate":
          // Model file start load: add a new progress item to the list.
          setReady(false);
          setProgressItems((prev) => [...prev, message]);
          break;

        case "progress":
          // Model file progress: update one of the progress items.
          setStatus(`正在下載模型`);
          setDownloading(true);
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === message.file) {
                return { ...item, progress: e.data.progress ?? 0 };
              }
              return item;
            }),
          );
          break;

        case "done":
          // Model file loaded: remove the progress item from the list.
          setStatus(`正在載入模型`);
          setDownloading(false);
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== message.file),
          );
          setDownloaded(true);
          break;

        case "ready":
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          setStatus(`點選右方授權麥克風並開始即時轉錄`);
          break;

        case "vad_done":
          setRunning(true);
          setStatus(`聆聽中⋯`);
          setTranscript((transcript) => [message.data.text, ...transcript]);
          setProcessing(false);
          // 處理下一個在佇列中的音訊
          processNextAudio();
          break;
        case "error":
          setRunning(false);
          setStatus(`發生錯誤`);
          alert(message.data);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () =>
      worker.current?.removeEventListener("message", onMessageReceived);
  });
  useEffect(() => {
    if (downloaded) {
      initial();
    }
  }, [downloaded, worker]);
  const initial = () => {
    worker.current!.postMessage({ type: "load" });
  };
  const processNextAudio = () => {
    if (audioQueue.length > 0) {
      const nextAudio = audioQueue[0];
      setAudioQueue((queue) => queue.slice(1));
      processAudio(nextAudio);
    }
  };

  const processAudio = async (audio: Float32Array) => {
    try {
      if (processing) {
        // 如果正在處理其他音訊，將此音訊加入佇列
        setAudioQueue((queue) => [...queue, audio]);
        return;
      }
      setProcessing(true);
      setProgress(0);
      setStatus(
        `偵測到靜音 - ${new Date().toLocaleTimeString("zh-TW", {
          hour12: false,
        })}`,
      );
      worker.current!.postMessage({
        type: "run",
        data: { audio, language: "chinese" },
      });
    } catch (e) {
      setProcessing(false);
      alert(e);
    }
  };
  return IS_WEBGPU_AVAILABLE ? (
    <div className="flex h-screen max-h-[100svh] w-full flex-col bg-gray-900">
      <div
        className={twMerge(
          "container relative mx-auto w-full flex-1 overflow-y-scroll bg-gray-900",
          transcript.length > 0 && "pt-[52px]",
        )}
        ref={transcriptContainerRef}
      >
        <div
          className={twMerge(
            "flex h-full flex-col gap-2 p-6",
            !transcript && `justify-center`,
          )}
        >
          {transcript.length > 0 && (
            <div className="fixed top-0 z-10 w-full bg-gray-900/80 py-3 backdrop-blur-md">
              <h1 className="text-xl font-bold text-white">
                Live Whisper Caption
              </h1>
            </div>
          )}
          {transcript.length === 0 && (
            <>
              <div className="h-[35vh]" />
              <h1 className="text-4xl font-bold text-white">
                Live Whisper Caption
              </h1>
              <p className="text-xl text-gray-300">即時字幕</p>
              <p className="text-xl">
                <a
                  className="text-indigo-400 underline hover:text-indigo-300"
                  href="https://github.com/gnehs/live-whisper-caption"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </p>

              <div className="flex-1" />
            </>
          )}
          {transcript.length > 0 && (
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {transcript.map((chunk, index) => (
                  <motion.div
                    key={transcript.length - index}
                    className="overflow-hidden"
                    initial={{
                      opacity: 0,
                      height: 0,
                    }}
                    animate={{
                      opacity: 1,
                      height: "auto",
                    }}
                  >
                    <motion.div
                      className={twMerge(
                        "rounded-xl border-b border-t border-b-black/5 border-t-white/5 bg-gray-800 px-4 py-2 text-white shadow-md transition-all",
                      )}
                      style={{
                        fontSize: `${Math.max(32 - index * 8, 16)}px`,
                      }}
                    >
                      {chunk}
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <div className="flex flex-col gap-2 pb-2">
            {progressItems.map((item, index) => (
              <div
                key={index}
                className="relative overflow-hidden rounded-lg bg-gray-800 p-2 px-4 shadow-xl shadow-black/5"
              >
                <div
                  className={twMerge(
                    "absolute left-0 top-0 h-full bg-gray-700 transition-all duration-300",
                  )}
                  style={{
                    width: `${item.progress}%`,
                  }}
                />
                <div className="relative flex items-center justify-between gap-2 font-mono text-white">
                  <div className="">
                    <div className="text-sm opacity-50"> {item.name} </div>
                    <div className=""> {item.file} </div>
                  </div>

                  <div className="opacity-50">
                    {(item.progress ?? 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {progress > 0 && (
        <div
          className="h-1 bg-indigo-400 transition-all duration-300"
          style={{
            width: `${progress}%`,
          }}
        />
      )}
      {!ready && (
        <div className="border-t border-t-white/5 bg-gray-800">
          <div className="container mx-auto flex items-center justify-between gap-2 bg-gray-800 p-6">
            <p className="text-white opacity-50">{status}</p>
            <button
              className="flex w-max items-center gap-3 rounded-xl bg-gray-700 px-4 py-2 font-semibold text-gray-200 transition-colors hover:bg-gray-600 active:bg-gray-500 active:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={downloading || downloaded}
              onClick={initial}
            >
              {downloading || downloaded ? (
                <Loader className="animate-spin" />
              ) : (
                <HardDriveDownload />
              )}
              {!downloaded && downloading ? "下載中⋯" : ""}
              {downloaded && !downloading ? "載入中⋯" : "下載模型"}
            </button>
          </div>
        </div>
      )}
      {ready && (
        <div className="border-t border-gray-700 bg-gray-800">
          <div className="container mx-auto flex items-center justify-between gap-2 bg-gray-800 p-6">
            <div className="flex items-center gap-2 text-white">
              {vad.userSpeaking ? <Mic /> : <MicOff className="opacity-50" />}
              <p className="opacity-50">{status}</p>
            </div>
            {!running && (
              <button
                className="flex w-max items-center gap-3 rounded-xl bg-gray-700 px-4 py-2 font-semibold text-gray-200 transition-colors hover:bg-gray-600 active:bg-gray-500 active:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setRunning(true);
                  vad.start();
                }}
                disabled={running}
              >
                {running ? <Loader className="animate-spin" /> : <Play />}
                開始
              </button>
            )}
            {running && (
              <button
                className="flex w-max items-center gap-3 rounded-xl bg-gray-700 px-4 py-2 font-semibold text-gray-200 transition-colors hover:bg-gray-600 active:bg-gray-500 active:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setRunning(false);
                  vad.pause();
                }}
              >
                <Pause />
                暫停
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="fixed z-10 flex h-screen w-screen items-center justify-center bg-black bg-opacity-[92%] text-center text-2xl font-semibold text-white">
      WebGPU is not supported
      <br />
      by this browser :&#40;
    </div>
  );
}

export default App;
