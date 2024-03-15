import Peer, { Instance as SimplePeerInstance } from "simple-peer";
import { useState, useEffect, FormEventHandler, useRef, useMemo } from "react";
import { ICallInitData, ICallData } from "../interfaces/call";
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
import { ImFinder } from "react-icons/im";
import { FaConnectdevelop } from "react-icons/fa";
import { FaRegCopy } from "react-icons/fa6";
import { FaGlobeAmericas } from "react-icons/fa";
import { TbCloudDataConnection } from "react-icons/tb";
import { AiTwotoneLock } from "react-icons/ai";
import { GoDownload, GoFile } from "react-icons/go";
import { MdOutlineCancel } from "react-icons/md";
import { FaFolder } from "react-icons/fa";
import { IoIosArrowDown } from "react-icons/io";
import { GrSend } from "react-icons/gr";
import { FaFile } from "react-icons/fa6";
import { MdConnectWithoutContact } from "react-icons/md";

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
  // const signalingState: SignalingState = "connecting";
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

  if (!isSocketConnected)
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="flex flex-col items-center justify-center">
          <FaConnectdevelop className="text-4xl mb-2" />
          Connecting...
        </div>
      </div>
    );

  if (signalingState !== "connected")
    return (
      <div className="p-8 flex-1 flex justify-center items-center">
        <div className="flex flex-col items-center md:flex-row md:justify-center">
          <FaGlobeAmericas className="text-7xl md:text-9xl mb-6 md:mb-0 md:mr-6" />
          <div className="flex flex-col items-center md:items-start">
            <h1 className="text-2xl font-bold mb-1">Your ID</h1>
            <div className="flex">
              <p className="text-2xl font-extralight mr-2">{id}</p>
              <button
                className="rounded-lg border border-gray-400 p-2"
                onClick={handleIdCopy}
              >
                <FaRegCopy />
              </button>
            </div>
            <form className="flex flex-col mt-4" onSubmit={handleSubmit}>
              <input
                required
                min={100000}
                ref={peerIdInputRef}
                type="number"
                placeholder="Connect to ID"
                autoFocus
                className="rounded-lg p-2 outline-2 outline-blue-800 border border-gray-300"
              />
              <button
                className="bg-blue-800 text-white p-2 py-1 rounded-lg font-light mt-2"
                type="submit"
                disabled={signalingState === "connecting"}
              >
                {signalingState === "connecting" ? "Connecting..." : "Connect"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );

  if (signalingState === "connected")
    return (
      <div className="px-3 py-5 md:py-14 md:px-36">
        <Transition
          appear
          show={isSendingModalOpen}
          as={Fragment}
          afterLeave={handleSendingModalClose}
          afterEnter={handleSendingModalOpen}
        >
          <Dialog
            as="div"
            className="fixed z-10 top-0 left-0 p-4 flex justify-center items-center h-screen w-screen"
            onClose={handleDialogClose}
          >
            <Transition.Child
              as={Fragment}
              enter=" ease-in duration-200 transition-opacity"
              enterFrom="opacity-0"
              enterTo="opacity-40"
              leave=" ease-out duration-200 transition-opacity"
              leaveFrom="opacity-40"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay
                as="div"
                className="fixed top-0 left-0 w-full h-full bg-black opacity-80"
              />
            </Transition.Child>
            <Transition.Child
              as="main"
              className="bg-gray-200 z-20 p-5 rounded-lg max-w-lg overflow-hidden"
              enter="transition-all duration-200 ease-in"
              enterFrom="opacity-0 scale-0"
              enterTo="opacity-100 scale-100"
              leave="transition-all duration-200 ease-out"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-0"
            >
              <Dialog.Title className="flex items-center">
                <GrSend className="mr-2 text-xl" />
                <span className="font-bold">Send</span>
              </Dialog.Title>
              <div className="mt-4">
                <div className="flex items-center">
                  <span className="mr-2">
                    <FaFile />
                  </span>
                  <span
                    title={file?.name}
                    className="overflow-hidden whitespace-nowrap text-ellipsis text-sm"
                  >
                    {file?.name}
                  </span>
                </div>
                <p className="text-sm mt-1">
                  Size: {formatFileSize(file?.size)}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  className="bg-white w-full p-2 rounded-lg text-sm border border-gray-400"
                  onClick={handleDialogClose}
                >
                  Cancel
                </button>
                <div className="w-5"></div>
                <button
                  ref={sendButtonRef}
                  className="w-full p-2 bg-blue-800 text-white rounded-lg text-sm"
                  onClick={handleSendFile}
                >
                  Send
                </button>
              </div>
            </Transition.Child>
          </Dialog>
        </Transition>
        <div className="flex flex-col w-full md:flex-row">
          <div className="flex flex-col items-center md:items-start">
            <div className="md:flex items-center hidden">
              <MdConnectWithoutContact className="text-3xl mr-2" />
              <p className="font-light">Connected</p>
            </div>
            <div className="flex items-center text-2xl font-light md:mt-4">
              <p className="bg-gray-300 text- flex flex-col rounded-md p-3 pr-6 py-2 md:mr-3">
                <span className="text-xs">Your ID</span>
                <span>{id}</span>
              </p>
              <MdConnectWithoutContact className="text-3xl mx-4 md:hidden" />
              <p className="bg-gray-300 flex flex-col items-end rounded-md p-3 pl-6 py-2">
                <span className="text-xs">Peer ID</span>
                <span>{id}</span>
              </p>
            </div>
          </div>
          <FileInput
            droppable
            onChange={handleFileChange}
            className="bg-gray-100 border-gray-300 flex-1 overflow-hidden border py-8 px-4 rounded-lg flex justify-center items-center mt-4 md:mt-0 md:ml-8"
          >
            <span>
              <FaFile className="mr-2" />
            </span>
            <p className="overflow-hidden whitespace-nowrap text-ellipsis">
              {file ? file.name : "Select or drop files here"}
            </p>
          </FileInput>
        </div>

        <div className="w-full flex flex-col mt-4">
          {timelineFiles.map((file) => {
            const transportStatus =
              file.direction === "up" ? "Sent" : "Received";
            return (
              <div
                className="w-full border shadow rounded-lg bg-slate-100 mb-2.5"
                key={file.id}
              >
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                  <span>
                    <FaFile />
                  </span>
                  <p
                    title={file.name}
                    className="text-sm ml-2 overflow-hidden text-ellipsis whitespace-nowrap w-full"
                  >
                    {file.name}
                  </p>
                  <small className="ml-2 flex-shrink-0">
                    {formatFileSize(file.size)}
                  </small>
                </div>

                <div className="p-2 px-3 flex justify-between bg-gray-200">
                  <small>
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
                          <MdOutlineCancel />
                        </button>
                      ) : (
                        file.direction === "down" && (
                          <button onClick={() => saveFile(file.id)}>
                            <GoDownload />
                          </button>
                        )
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
}
