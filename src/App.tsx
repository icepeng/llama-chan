import { Box, Button, Input, Stack, Divider } from "@chakra-ui/react";
import { open } from "@tauri-apps/api/dialog";
import { Event, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
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
    return "";
  }

  return message.split("### Response:")[1].replace("[end of text]", "").trim();
}

function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);

  async function openModel() {
    const modelPath = await open();
    await invoke("load_model", { modelPath });
    setIsModelLoaded(true);
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
    <Stack height="100vh" direction="column">
      <Box padding={4}>
        <Button onClick={openModel}>Open Model...</Button>
      </Box>
      <Stack flex="1 1 auto">
        {history.map(({ from, message }, i) => (
          <Box backgroundColor={from === "user" ? "gray.50" : "gray.100"} padding={4} key={i}>
            {from}: {from === "user" ? message : parseResponse(message)}
          </Box>
        ))}
      </Stack>
      <Stack padding={4} direction="row">
        <Input
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          placeholder="Enter a message..."
        />
        <Button onClick={sendMessage}>Send</Button>
      </Stack>
    </Stack>
  );
}

export default App;
