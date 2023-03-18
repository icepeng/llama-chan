import { open } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import { Event, listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");

  async function openModel() {
    const modelPath = await open();
    await invoke("load_model", { modelPath });
  }

  async function sendMessage() {
    await invoke("send_message", { message });
  }

  useEffect(() => {
    const unlisten = listen("message", (event: Event<string>) => {
      console.log(event.payload);
      setResponse((response) => response + event.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div className="container">
      <h1>LLaMA-Chan</h1>

      <div className="row">
        <button onClick={openModel}>Open Model...</button>
        <input id="greet-input" onChange={(e) => setMessage(e.currentTarget.value)} placeholder="Enter a message..." />
        <button onClick={sendMessage}>Send Message</button>
      </div>
      <textarea readOnly value={response} style={{ height: 400 }}></textarea>
    </div>
  );
}

export default App;
