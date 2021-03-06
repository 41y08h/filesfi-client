import Peer, { Instance as SimplePeerInstance } from "simple-peer";
import { useState, useEffect, FormEventHandler, useRef, useMemo } from "react";
import { ICallInitData, ICallData } from "../interfaces/call";
import styles from "../styles/Home.module.scss";
import IdDisplay from "../components/IdDisplay";
import FileInput from "../components/FileInput";
import socket from "../RTCs/socket";
import useEventSubscription from "../hooks/useEventSubscription";
import { toast } from "react-toastify";
import readInChunks, { stopReadingInChunks } from "../utils/readInChunks";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import formatFileSize from "../utils/formatFileSize";
import copy from "copy-to-clipboard";
import { v4 as uuid } from "uuid";
import RTCDataTransport from "../utils/RTCDataTransport";
import streamSaver from "streamsaver";
import Head from "next/head";

type SignalingState = "idle" | "connecting" | "connected";
type RTCTransportDataType =
  | "fileTransport/fileInfo"
  | "fileTransport/sendingCancelled"
  | "fileTransport/receivingCancelled";
type RTCTransportData<T = any> = { type: RTCTransportDataType; payload?: T };
type FileInfo = {
  id: string;
  name: string;
  size: number;
  progress: number;
  chunk?: Uint8Array;
};

interface TimelineFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  direction: "up" | "down";
  chunkingId?: string;
  isCancelled: boolean;
}

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
  const [isSendingModalOpen, setIsSendingModalOpen] = useState(false);

  const sendButtonRef = useRef<HTMLButtonElement>();

  const worker = useMemo(() => new Worker("/worker.js"), []);

  const rtcDataTransport = useMemo(
    () =>
      connection
        ? RTCDataTransport((chunk) => connection.write(chunk))
        : undefined,
    [connection]
  );
  const [timelineFiles, setTimelineFiles] = useState<TimelineFile[]>([]);

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
    const fileInfo: RTCTransportData<FileInfo> = {
      type: "fileTransport/fileInfo",
      payload: {
        id: fileId,
        name: file.name,
        size: file.size,
        progress: 0,
      },
    };
    rtcDataTransport.send(fileInfo);

    // Transport file in chunks
    // Chunking id is used to stop the process
    const chunkingId = readInChunks(file, {
      onRead(chunk, { progress }) {
        // Update progress state
        setTimelineFiles((timelineFiles) =>
          timelineFiles.map((file) =>
            file.id === fileId ? { ...file, progress } : file
          )
        );

        rtcDataTransport.send<RTCTransportData<FileInfo>>({
          type: "fileTransport/fileInfo",
          payload: {
            id: fileId,
            name: file.name,
            size: file.size,
            progress,
            chunk: new Uint8Array(chunk),
          },
        });
      },
    });

    // Update timeline
    setTimelineFiles((old) => [
      ...old,
      { ...fileInfo.payload, direction: "up", chunkingId, isCancelled: false },
    ]);
    setIsSendingModalOpen(false);
  }

  function saveFile(fileId: string) {
    worker.postMessage({ type: "saveFile", payload: { fileId } });
  }

  function stopSendingFile(file?: TimelineFile) {
    rtcDataTransport.send({
      type: "fileTransport/sendingCancelled",
      payload: {
        fileId: file.id,
      },
    });

    // Stop chunking
    stopReadingInChunks(file.chunkingId);
    console.log(file.id);

    // Update timeline
    setTimelineFiles((timelineFiles) =>
      timelineFiles.map((timelineFile) =>
        timelineFile.id === file.id
          ? { ...timelineFile, isCancelled: true }
          : timelineFile
      )
    );
  }

  function stopReceivingFile(file?: TimelineFile) {
    rtcDataTransport.send<RTCTransportData>({
      type: "fileTransport/receivingCancelled",
      payload: {
        fileId: file.id,
      },
    });

    // Update timeline
    setTimelineFiles((timelineFiles) =>
      timelineFiles.map((timelineFile) =>
        timelineFile.id === file.id
          ? { ...timelineFile, isCancelled: true }
          : timelineFile
      )
    );
  }

  useEffect(() => {
    if (!connection) return;

    function handleWorkerMessage(event) {
      if (event.data.type === "saveFile/callback") {
        const { fileId, blob } = event.data.payload;
        const file = timelineFiles.find((file) => file.id === fileId);

        console.log("file", file);
        if (!file) return;

        const stream = blob.stream();
        const fileStream = streamSaver.createWriteStream(file.name);
        stream.pipeTo(fileStream);
      }
    }

    function handleData(chunk) {
      rtcDataTransport.handleData<RTCTransportData>(chunk, (data) => {
        console.log(data.type);

        if (data.type === "fileTransport/fileInfo") {
          const file: TimelineFile = {
            id: data.payload.id,
            name: data.payload.name,
            size: data.payload.size,
            progress: data.payload.progress,
            direction: "down",
            isCancelled: false,
          };

          // Update timeline files
          const isNew = file.progress === 0;
          if (isNew) {
            setTimelineFiles((old) => [...old, file]);
          } else {
            setTimelineFiles((old) =>
              old.map((timelineFile) =>
                timelineFile.id === file.id
                  ? { ...file, isCancelled: timelineFile.isCancelled }
                  : timelineFile
              )
            );

            // Send chunks to worker
            worker.postMessage({
              type: "fileChunk",
              payload: {
                fileId: data.payload.id,
                chunk: data.payload.chunk,
              },
            });
          }
        } else if (data.type === "fileTransport/sendingCancelled") {
          const { fileId } = data.payload;
          setTimelineFiles((timelineFiles) =>
            timelineFiles.map((timelineFile) =>
              timelineFile.id === fileId
                ? { ...timelineFile, isCancelled: true }
                : timelineFile
            )
          );
        } else if (data.type === "fileTransport/receivingCancelled") {
          const { fileId } = data.payload;

          stopSendingFile(
            timelineFiles.find((timelineFile) => timelineFile.id === fileId)
          );
        }
      });
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
  }, [worker, connection, timelineFiles, rtcDataTransport]);

  function handleIdCopy() {
    copy(id.toString());
    toast.success("Copied", { pauseOnFocusLoss: false });
  }

  // Sending Modal

  function handleSendingModalOpen() {
    const sendButton = sendButtonRef.current;
    sendButton.focus();
  }

  function handleSendingModalClose() {
    setFile(undefined);
  }

  function handleDialogClose() {
    setIsSendingModalOpen(false);
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>FilesFi</title>
      </Head>
      <Transition
        appear
        show={isSendingModalOpen}
        as={Fragment}
        afterLeave={handleSendingModalClose}
        afterEnter={handleSendingModalOpen}
      >
        <Dialog as="div" className={styles.modal} onClose={handleDialogClose}>
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
              <small className="line-clamp-2">File: {file?.name}</small>
              <small>Size: {formatFileSize(file?.size)}</small>
            </div>

            <div className={styles.actionButtons}>
              <button onClick={handleDialogClose}>Cancel</button>
              <button
                ref={sendButtonRef}
                className={styles.sendButton}
                onClick={handleSendFile}
              >
                Send
              </button>
            </div>
          </Transition.Child>
        </Dialog>
      </Transition>

      <div className={styles.content}>
        <div className={styles.top}>
          <div className={styles.topContent}>
            {isSocketConnected ? (
              <div>
                <p className={styles.idHeading}>Your ID</p>
                <div className={styles.idContainer}>
                  <IdDisplay id={id} />
                  <button className={styles.copyButton} onClick={handleIdCopy}>
                    ????
                  </button>
                </div>
              </div>
            ) : (
              "Connecting..."
            )}

            {signalingState === "connected" && (
              <div className={styles.actionInterface}>
                <p>???? Connected to peer</p>
                <FileInput
                  droppable
                  className={styles.fileInput}
                  onChange={handleFileChange}
                >
                  {file ? file.name : "Select or drop files here"}
                </FileInput>
              </div>
            )}
          </div>
        </div>
        <div className={styles.innerContent}>
          {signalingState === "connected" && (
            <div className={styles.files}>
              {timelineFiles.map((file) => {
                const transportStatus =
                  file.direction === "up" ? "Sent" : "Received";

                return (
                  <div className={styles.file} key={file.id}>
                    <p className={styles.filename}>{file.name}</p>
                    <div className={styles.fileBottom}>
                      <small>
                        ({formatFileSize(file.size)}){" "}
                        {file.isCancelled
                          ? "Cancelled"
                          : file.progress < 100
                          ? `${Math.floor(file.progress)}% ${transportStatus}`
                          : transportStatus}
                      </small>
                      <div>
                        {!file.isCancelled &&
                          (file.progress < 100 ? (
                            <button
                              onClick={() =>
                                file.direction === "up"
                                  ? stopSendingFile(file)
                                  : stopReceivingFile(file)
                              }
                            >
                              Cancel
                            </button>
                          ) : (
                            file.direction === "down" && (
                              <button onClick={() => saveFile(file.id)}>
                                Save
                              </button>
                            )
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  autoFocus
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
