import { open } from "@tauri-apps/api/dialog";
import { Event, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import React, { useEffect, useState } from "react";
import "./App.css";

interface Message {
  from: "user" | "bot";
  message: string;
}

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

function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);

  async function openModel() {
    setIsModelLoading(true);
    const modelPath = await open();
    await invoke("load_model", { modelPath });
    setIsModelLoaded(true);
    setIsModelLoading(false);
  }

  async function sendMessage() {
    if (!isModelLoaded) {
      return;
    }

    setMessage("");
    setHistory((history) => [...history, { from: "user", message }, { from: "bot", message: "" }]);
    await invoke("send_message", { message: buildPrompt(message) });
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
    <div className="flex flex-col h-screen overflow-auto p-4">
      <div>
        <button className={"btn" + (isModelLoading ? " loading" : "")} onClick={openModel}>
          Open Model...
        </button>
      </div>
      <div className="flex-auto flex flex-col-reverse  mb-20">
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
  );
}

export default App;
