import Peer, { Instance as SimplePeerInstance } from "simple-peer";
import { useState, useEffect, FormEventHandler, useRef } from "react";
import { ICallInitData, ICallData } from "../interfaces/call";
import styles from "../styles/Home.module.scss";
import IdDisplay from "../components/IdDisplay";
import FileInput from "../components/FileInput";
import socket from "../RTCs/socket";
import useEventSubscription from "../hooks/useEventSubscription";

function useClientSideInit<T>(initializer: () => T) {
  let value: T;

  useEffect(() => {
    value = initializer();
  }, []);

  return value;
}

type CallState = "idle" | "calling" | "connected";

export default function Home() {
  const [id, setId] = useState<number>();
  const [callState, setCallState] = useState<CallState>("idle");
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const peerIdInputRef = useRef<HTMLInputElement>();
  const callerRef = useRef<SimplePeerInstance>();
  const [file, setFile] = useState<File>();
  const [connection, setConnection] = useState<SimplePeerInstance>();
  const [gotFile, setGotFile] = useState();

  const worker = useClientSideInit<Worker>(() => new Worker("/worker.js"));
  const streamSaver = useClientSideInit(() => require("streamsaver"));

  // WebSocket connectivity
  useEffect(() => {
    socket.emit("join");
  }, []);

  useEventSubscription("join/callback", (id: number) => {
    setId(id);
    setIsSocketConnected(true);
  });

  useEventSubscription("disconnect", () => {
    setIsSocketConnected(false);
  });

  useEventSubscription("peerIsCalling", async (call: ICallData) => {
    const callee = new Peer({ trickle: false });

    // Set caller's signal
    callee.signal(call.signal);
    callee.on("connect", getCallConnectedHandler(callee));

    callee.on("signal", (signal) => {
      const callerId = call.callerId;
      const answerCallPayload: ICallInitData = { callerId, signal };

      socket.emit("answerCall", answerCallPayload);
    });
  });

  useEventSubscription("callAnswered", (signal) => {
    const caller = callerRef.current;
    if (caller) caller.signal(signal);
  });

  const handleSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    // Create a caller in webrtc
    callerRef.current = new Peer({ initiator: true, trickle: false });

    const caller = callerRef.current;
    caller.on("connect", getCallConnectedHandler(caller));

    setCallState("calling");

    caller.on("signal", (signal) => {
      // Send caller's signal to the peer
      const peerId = parseInt(peerIdInputRef.current.value);
      const callPayload: ICallInit = { peerId, signal };

      socket.emit("callPeer", callPayload);
    });
  };

  function getCallConnectedHandler(peer: SimplePeerInstance) {
    setConnection(peer);

    return () => {
      setCallState("connected");
    };
  }

  const handleFiles = (files: FileList) => {
    setFile(files[0]);
  };

  function handleSendFile() {
    const stream = file.stream();
    const reader = stream.getReader();

    reader.read().then((chunk) => {
      handleReading(chunk.done, chunk.value);
    });

    function handleReading(done: boolean, chunk) {
      if (done) {
        return connection.write(
          JSON.stringify({ done: true, filename: file.name })
        );
      }
      connection.write(chunk);
      reader.read().then((chunk) => {
        handleReading(chunk.done, chunk.value);
      });
    }
  }

  useEffect(() => {
    if (!connection || !worker) return;

    function handleReceivingData(data) {
      if (data.toString().includes("done")) {
        const parsed = JSON.parse(data);
        setGotFile(parsed);

        worker.postMessage("download");
        worker.addEventListener("message", (event) => {
          const stream = event.data.stream();
          const fileStream = streamSaver?.createWriteStream("savers.pdf");
          stream.pipeTo(fileStream);
        });
      } else {
        worker.postMessage(data);
      }
    }

    connection.on("data", handleReceivingData);
  }, [connection, worker]);

  return (
    <div className={styles.container}>
      {isSocketConnected ? (
        <div>
          <p className={styles.idHeading}>Your ID</p>
          <IdDisplay id={id} />
          <div className={styles.innerContent}>
            {callState === "connected" && (
              <div className={styles.mainInterface}>
                <p>🔒 Connected</p>
                <div>
                  <FileInput
                    droppable
                    className={styles.sendFile}
                    onChange={handleFiles}
                  >
                    {file ? file.name : "Select or Drop files here"}
                  </FileInput>
                  <button onClick={handleSendFile}>Send</button>
                </div>
              </div>
            )}

            {(callState === "idle" || callState === "calling") && (
              <form className={styles.connectForm} onSubmit={handleSubmit}>
                <input
                  required
                  ref={peerIdInputRef}
                  type="number"
                  placeholder="Connect to ID"
                />
                <button type="submit" disabled={callState === "calling"}>
                  {callState === "idle" ? "Connect" : "Connecting..."}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        "Connecting..."
      )}
    </div>
  );
}
