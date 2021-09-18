import Peer, { Instance as SimplePeerInstance } from "simple-peer";
import { useState, useEffect, FormEventHandler, useRef } from "react";
import { ICallInitData, ICallData } from "../interfaces/call";
import styles from "../styles/Home.module.scss";
import IdDisplay from "../components/IdDisplay";
import FileInput from "../components/FileInput";
import socket from "../RTCs/socket";
import useEventSubscription from "../hooks/useEventSubscription";
import useClientSideInit from "../hooks/useClientSideInit";
import { toast } from "react-toastify";
import readInChunks from "../utils/readInChunks";

type SignalingState = "idle" | "connecting" | "connected";
type RTCSerialDataType = "fileTransport";
type RTCSerialData = { type: RTCSerialDataType; payload: any };
type FileTransport = { name: string; progress: number };

export default function Home() {
  // WebSocket
  const [id, setId] = useState<number>();
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // WebRTC Signaling
  const [signalingState, setSignalingState] = useState<SignalingState>("idle");
  const peerIdInputRef = useRef<HTMLInputElement>();
  const callerRef = useRef<SimplePeerInstance>();
  const calleeRef = useRef<SimplePeerInstance>();
  const [incomingCall, setIncomingCall] = useState<ICallData>();

  // Connected UI
  const [connection, setConnection] = useState<SimplePeerInstance>();

  const [file, setFile] = useState<File>();
  const [receivingFile, setReceivingFile] = useState<FileTransport>();
  const [sendingFile, setSendingFile] = useState<FileTransport>();

  // File transport
  const worker = useClientSideInit(() => new Worker("/worker.js"));
  const streamSaver = useClientSideInit(() => require("streamsaver"));

  // WebSocket connectivity
  useEventSubscription("connect", () => {
    socket.emit("join");
  });

  useEventSubscription("join/callback", (id: number) => {
    setId(id);
    setIsSocketConnected(true);
  });

  useEventSubscription("disconnect", () => {
    setIsSocketConnected(false);
  });

  useEventSubscription("exception/callPeer", (error) => {
    if (error.type === "deviceBusy") {
      toast.error("Requested device is busy");
    } else if (error.type === "callingSelf") {
      toast.error("Calling self is not allowed");
    } else if (error.type === "deviceNotFound") {
      toast.error("Device not found");
    }

    callerRef.current.destroy();
    callerRef.current = undefined;
    setSignalingState("idle");
  });

  useEventSubscription("peerIsCalling", async (call: ICallData) => {
    if (["connected", "connecting"].includes(signalingState)) {
      return socket.emit("exception/peerIsCalling", {
        type: "busy",
        payload: { callerId: call.callerId },
      });
    }
    calleeRef.current = new Peer({ trickle: false });
    calleeRef.current.signal(call.signal);

    setIncomingCall(call);
  });

  useEventSubscription("callAnswered", (signal) => {
    const caller = callerRef.current;
    if (caller) caller.signal(signal);
  });

  const handleSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    callerRef.current = new Peer({ initiator: true, trickle: false });

    setSignalingState("connecting");
  };

  // Caller and callee event handler attachments
  function getCallConnectedHandler(peer: SimplePeerInstance) {
    setConnection(peer);

    return () => {
      setSignalingState("connected");
    };
  }

  useEffect(() => {
    const caller = callerRef.current;
    if (!caller) return;

    // Handler call connection
    const handleCallConnected = getCallConnectedHandler(caller);
    caller.on("connect", handleCallConnected);

    // Handler signaling
    function handleSignal(signal) {
      // Send caller's signal to the peer
      const peerId = parseInt(peerIdInputRef.current.value);
      const callPayload: ICallInitData = { peerId, signal };

      socket.emit("callPeer", callPayload);
    }
    caller.on("signal", handleSignal);

    return () => {
      caller.off("connect", handleCallConnected);
      caller.off("signal", handleSignal);
    };
  }, [callerRef.current]);

  useEffect(() => {
    const callee = calleeRef.current;
    if (!callee) return;

    const call = incomingCall;

    const handleCallConnected = getCallConnectedHandler(callee);
    callee.on("connect", handleCallConnected);

    function handleSignal(signal) {
      const callerId = call.callerId;
      const answerCallPayload: ICallData = { callerId, signal };

      socket.emit("answerCall", answerCallPayload);
    }

    callee.on("signal", handleSignal);

    return () => {
      callee.off("connect", handleCallConnected);
      callee.off("signal", handleSignal);
    };
  }, [calleeRef.current]);

  const handleFileChange = (files: FileList) => {
    setFile(files[0]);
  };

  function handleSendFile() {
    setSendingFile({ name: file.name, progress: 0 });

    const data: RTCSerialData = {
      type: "fileTransport",
      payload: {
        filename: file.name,
        progress: 0,
      },
    };
    connection.write(JSON.stringify(data));

    // Transport file recursively
    readInChunks(file, {
      onRead(chunk, { progress }) {
        setSendingFile((old) => ({ ...old, progress }));

        const fileData = new Uint8Array(chunk);
        connection.write(fileData);

        const data: RTCSerialData = {
          type: "fileTransport",
          payload: {
            name: file.name,
            progress,
          },
        };
        connection.write(JSON.stringify(data));
      },
      onSuccess() {
        // Notify by WebRTC that file transport is complete
        const data: RTCSerialData = {
          type: "fileTransport",
          payload: {
            name: file.name,
            progress: 100,
          },
        };
        connection.write(JSON.stringify(data));

        setFile(undefined);
        setSendingFile(undefined);
        toast.success(`Sent ${file.name}`);
      },
    });
  }

  function downloadFile() {
    // Initiate download
    worker.postMessage("downloadFile");
  }

  useEffect(() => {
    if (!worker || !connection) return;

    function handleWorkerMessage(event) {
      const stream = event.data.stream();
      const fileStream = streamSaver?.createWriteStream(receivingFile.name);
      stream.pipeTo(fileStream);
    }

    function handleData(chunk) {
      const isSerialData = chunk.toString().includes("payload");
      if (isSerialData) {
        const data: RTCSerialData = JSON.parse(chunk);
        if (data.type === "fileTransport") {
          setReceivingFile(data.payload);
        } else {
          // File chunk
          worker.postMessage(chunk);
        }
      }
    }

    function handleClose() {
      connection.destroy();
      setConnection(undefined);

      if (signalingState === "connected")
        toast.error("Connection has been closed");

      setSignalingState("idle");
    }

    function handleError(error) {
      if (error.code === "ERR_DATA_CHANNEL") {
        handleClose();
      }
    }

    connection.on("data", handleData);
    connection.on("error", handleError);
    connection.on("close", handleClose);
    worker.addEventListener("message", handleWorkerMessage);

    return () => {
      connection.off("data", handleData);
      connection.off("error", handleError);
      connection.off("close", handleClose);

      worker.removeEventListener("message", handleWorkerMessage);
    };
  }, [worker, connection, receivingFile]);

  return (
    <div className={styles.container}>
      {isSocketConnected ? (
        <div>
          <p className={styles.idHeading}>Your ID</p>
          <IdDisplay id={id} />
          <div className={styles.innerContent}>
            {signalingState === "connected" && (
              <div className={styles.mainInterface}>
                <p>🔒 Connected</p>
                <div className={styles.fileInterfaceContainer}>
                  <div>
                    <FileInput
                      droppable
                      className={styles.sendFile}
                      onChange={handleFileChange}
                    >
                      {file ? file.name : "Select or Drop files here"}
                    </FileInput>
                    {(file || sendingFile) && (
                      <button
                        className={styles.sendFileButton}
                        disabled={!!sendingFile}
                        onClick={handleSendFile}
                      >
                        {sendingFile
                          ? `Sending (${Math.floor(sendingFile.progress)}%)`
                          : "Send"}
                      </button>
                    )}
                  </div>
                  {receivingFile?.progress < 100 ? (
                    <p>{receivingFile.progress}%</p>
                  ) : null}
                  {receivingFile?.progress === 100 && (
                    <div>
                      <p>
                        Your peer has sent you{" "}
                        <strong>{receivingFile.name}</strong>
                      </p>
                      <button
                        onClick={downloadFile}
                        className={styles.downloadButton}
                      >
                        Download
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(signalingState === "idle" || signalingState === "connecting") && (
              <form className={styles.connectForm} onSubmit={handleSubmit}>
                <input
                  required
                  min={100000}
                  ref={peerIdInputRef}
                  type="number"
                  placeholder="Connect to ID"
                />
                <button
                  type="submit"
                  disabled={signalingState === "connecting"}
                >
                  {signalingState === "idle" ? "Connect" : "Connecting..."}
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
