import { open } from "@tauri-apps/api/dialog";
import { Event, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import React, { useEffect, useState } from "react";
import "./App.css";
import SettingButton from "./components/setting/SettingButton";
import SettingDrawerWrapper, { InferenceParameters } from "./components/setting/SettingDrawerWrapper";

interface Message {
  from: "user" | "bot";
  message: string;
}

const defaultInferenceParameters: InferenceParameters = {
  n_batch: 8,
  top_k: 1,
  top_p: 0.1,
  repeat_penalty: 1.18,
  temp: 0.7,
} as const;

function buildPrompt(message: string) {
  return `Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:

${message}

### Response:`;
}

function parseResponse(message: string) {
  if (!message.includes("### Response:")) {
    return "typing...";
  }

  const parsed = message.split("### Response:")[1].replace("[end of text]", "").trim();

  return parsed;
}

function convertInferenceParameters(inferenceParameters: InferenceParameters) {
  return Object.entries(inferenceParameters).reduce((acc, [key, value]) => {
    return { ...acc, [key]: parseFloat(value as string) };
  }, {} as Record<keyof InferenceParameters, number>);
}

function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [inferenceParameters, setInferenceParameters] = useState<InferenceParameters>({
    ...defaultInferenceParameters,
  });

  async function openModel() {
    setIsModelLoading(true);
    const modelPath = await open();
    if (modelPath) {
      try {
        await invoke("load_model", { modelPath });
        setIsModelLoaded(true);
      } catch (error) {
        setIsModelLoaded(false);
      }
    }
    setIsModelLoading(false);
  }

  async function sendMessage() {
    if (!isModelLoaded) {
      return;
    }

    setMessage("");
    setHistory((history) => [...history, { from: "user", message }, { from: "bot", message: "" }]);
    console.log({ message, inferenceParameters });
    await invoke("send_message", {
      message: buildPrompt(message),
      inferenceParameters: convertInferenceParameters(inferenceParameters),
    });
  }

  useEffect(() => {
    const unlisten = listen("message", (event: Event<string>) => {
      setHistory((history) => {
        const lastResponse = history.at(-1)!;
        const message = lastResponse.message + event.payload;
        return [...history.slice(0, -1), { ...lastResponse, message }];
      });
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <SettingDrawerWrapper inferenceParameters={inferenceParameters} setInferenceParameters={setInferenceParameters}>
      <div className="flex flex-col h-screen overflow-auto p-4">
        <div className="flex justify-between">
          <button className={"btn" + (isModelLoading ? " loading" : "")} onClick={openModel}>
            Open Model...
          </button>
          <SettingButton />
        </div>
        <div className="flex-auto flex flex-col justify-end mb-20">
          {history.map(({ from, message }, i) => (
            <React.Fragment key={i}>
              {from === "user" ? (
                <div className="chat chat-end">
                  <div className="chat-bubble chat-bubble-primary">{message}</div>
                </div>
              ) : (
                <div className="chat chat-start">
                  <div className="chat-bubble">{parseResponse(message)}</div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        {isModelLoaded ? (
          <div className="absolute border-t border-gray-200 bg-white p-4 bottom-0 left-0 right-0 flex">
            <input
              className="flex-auto input input-bordered"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              placeholder="Enter a message..."
            />
            <button className="btn" onClick={sendMessage}>
              Send
            </button>
          </div>
        ) : (
          <div>Load model to start chat.</div>
        )}
      </div>
    </SettingDrawerWrapper>
  );
}

export default App;
