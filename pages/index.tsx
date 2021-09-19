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
import readInChunks, { stopReadingInChunks } from "../utils/readInChunks";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import formatFileSize from "../utils/formatFileSize";
import copy from "copy-to-clipboard";
import Progress from "../components/Progress";
import { v4 as uuid } from "uuid";

type SignalingState = "idle" | "connecting" | "connected";
type RTCSerialDataType =
  | "fileTransport/fileInfo"
  | "fileTransport/sendingCancelled"
  | "fileTransport/receivingCancelled";
type RTCSerialData<T = any> = { type: RTCSerialDataType; payload?: T };
type FileTransportInfo = { name: string; size: number; progress: number };
type FileTransportInfo2 = {
  id: string;
  name: string;
  size: number;
  progress: number;
};

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
  const [receivingFile, setReceivingFile] = useState<FileTransportInfo>();
  const [sendingFile, setSendingFile] = useState<FileTransportInfo>();
  const [isSendingModalOpen, setIsSendingModalOpen] = useState(false);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);

  const [sendingFileChunkingId, setSendingFileChunkingId] = useState<string>();

  const [filesTimeline, setFilesTimeline] = useState<FileTransportInfo2[]>([]);

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
    const file = files[0];
    setFile(file);
    if (file) setIsSendingModalOpen(true);
  };

  async function handleSendFile() {
    const fileId = uuid();
    const data: RTCSerialData<FileTransportInfo2> = {
      type: "fileTransport/fileInfo",
      payload: {
        id: fileId,
        name: file.name,
        size: file.size,
        progress: 0,
      },
    };
    connection.write(JSON.stringify(data));

    // Transport file in chunks
    const chunkingId = readInChunks(file, {
      onRead(chunk, { progress }) {
        setFilesTimeline((timeline) =>
          timeline.map((file) =>
            file.id === fileId ? { ...file, progress } : file
          )
        );

        const fileData = new Uint8Array(chunk);
        connection.write(fileData);

        const data: RTCSerialData<FileTransportInfo2> = {
          type: "fileTransport/fileInfo",
          payload: {
            id: fileId,
            name: file.name,
            size: file.size,
            progress,
          },
        };
        connection.write(JSON.stringify(data));
      },
    });

    // Insert into file timeline
    setFilesTimeline((old) => [...old, { ...data.payload, chunkingId }]);
    setIsSendingModalOpen(false);
  }

  function saveFile() {
    // Initiate download
    worker.postMessage("saveFile");
  }

  function stopSendingFile() {
    stopReadingInChunks(sendingFileChunkingId);
    setSendingFileChunkingId(undefined);
    setIsSendingModalOpen(false);

    const data: RTCSerialData = {
      type: "fileTransport/sendingCancelled",
    };
    connection.write(JSON.stringify(data));
  }

  useEffect(() => {
    if (!worker || !connection) return;

    function handleWorkerMessage(event) {
      const stream = event.data.stream();
      const fileStream = streamSaver?.createWriteStream(receivingFile.name);
      stream.pipeTo(fileStream);
    }

    function handleData(chunk) {
      const isSerialData = chunk.toString().includes("type");
      if (isSerialData) {
        const data: RTCSerialData = JSON.parse(chunk);
        if (data.type === "fileTransport/fileInfo") {
          setReceivingFile(data.payload);
          setIsReceivingModalOpen(true);
        } else if (data.type === "fileTransport/sendingCancelled") {
          setIsReceivingModalOpen(false);
          worker.postMessage("clearReceivedChunks");
          toast.info("Transfer has been aborted");
        }
      } else {
        // File chunk
        worker.postMessage(chunk);
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
      <div className={styles.content}>
        {isSocketConnected ? (
          <div>
            <p className={styles.idHeading}>Your ID</p>
            <div className={styles.idContainer}>
              <IdDisplay id={id} />
              <button
                className={styles.copyButton}
                onClick={() => {
                  copy(id.toString());
                  toast.success("Copied");
                }}
              >
                📋
              </button>
            </div>
          </div>
        ) : (
          "Connecting..."
        )}

        <Transition
          appear
          show={isSendingModalOpen}
          as={Fragment}
          afterLeave={() => setFile(undefined)}
        >
          <Dialog
            as="div"
            className={styles.modal}
            onClose={() => setIsSendingModalOpen(false)}
          >
            <Transition.Child
              as={Fragment}
              enter={styles.enter}
              enterFrom={styles.enterFrom}
              enterTo={styles.enterTo}
              leave={styles.leave}
              leaveFrom={styles.leaveFrom}
              leaveTo={styles.leaveTo}
            >
              <Dialog.Overlay as="div" className={styles.backdrop} />
            </Transition.Child>
            <Transition.Child
              as="main"
              enter={styles.enter}
              enterFrom={styles.enterFrom}
              enterTo={styles.enterTo}
              leave={styles.leave}
              leaveFrom={styles.leaveFrom}
              leaveTo={styles.leaveTo}
            >
              <Dialog.Title>Send</Dialog.Title>
              <div className={styles.fileInfo}>
                <small>File: {file?.name}</small>
                <small>Size: {formatFileSize(file?.size)}</small>
              </div>

              <div className={styles.actionButtons}>
                <button onClick={() => setIsSendingModalOpen(false)}>
                  Cancel
                </button>
                <button className={styles.sendButton} onClick={handleSendFile}>
                  Send
                </button>
              </div>
            </Transition.Child>
          </Dialog>
        </Transition>

        <div className={styles.innerContent}>
          {signalingState === "connected" && (
            <div className={styles.mainInterface}>
              <p>🔒 Connected to peer</p>
              <FileInput
                droppable
                className={styles.fileInput}
                onChange={handleFileChange}
              >
                {file ? file.name : "Select or drop files here"}
              </FileInput>
              <div>
                {filesTimeline.map((file) => (
                  <div className={styles.file}>
                    <p>
                      {file.name} ({formatFileSize(file.size)}) /{" "}
                      {file.progress < 100
                        ? `${Math.floor(file.progress)}%`
                        : "Sent"}
                    </p>
                    {file.progress < 100 && <button>Cancel</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(signalingState === "idle" || signalingState === "connecting") &&
            isSocketConnected && (
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
    </div>
  );
}
