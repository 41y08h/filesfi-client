import React, {
  createContext,
  FC,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Peer, { Instance as SimplePeerInstance } from "simple-peer";
import { ICallData, ICallInitData } from "../interfaces/call";
import useEventSubscription from "../hooks/useEventSubscription";
import socket from "../RTCs/socket";
import { TimelineFile } from "../components/Home";
import readInChunks, { stopReadingInChunks } from "../utils/readInChunks";
import { v4 as uuid } from "uuid";
import RTCDataTransport from "../utils/RTCDataTransport";
import toast from "react-hot-toast";

type SignalingState = "idle" | "connecting" | "connected";

type RTCTransportDataType =
  | "fileTransport/fileData"
  | "fileTransport/sendingCancelled"
  | "fileTransport/receivingCancelled";

type RTCTransportData<T = any> = { type: RTCTransportDataType; payload?: T };
type FileData = {
  id: string;
  name: string;
  size: number;
  progress: number;
  chunk?: Uint8Array;
};

interface WebRTCContextValue {
  signalingState: SignalingState;
  timelineFiles: TimelineFile[];
  call: (peerID: number) => any;
  sendFile: (file: File) => any;
  saveFile: (fileId: string) => any;
  stopSendingFile: (file: TimelineFile) => any;
  stopReceivingFile: (file: TimelineFile) => any;
  peerID?: number;
}

const WebRTCContext = createContext<WebRTCContextValue | undefined>(undefined);

export function useWebRTC(): WebRTCContextValue {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error("Expected the WebRTCContext to be initialized");
  return ctx;
}

export const WebRTCProvider: FC = ({ children }) => {
  const [signalingState, setSignalingState] = useState<SignalingState>("idle");
  const callerRef = useRef<SimplePeerInstance>();
  const calleeRef = useRef<SimplePeerInstance>();
  const [peerID, setPeerID] = useState<number>();
  const [incomingCall, setIncomingCall] = useState<ICallData>();
  const [connection, setConnection] = useState<SimplePeerInstance>();
  const [timelineFiles, setTimelineFiles] = useState<TimelineFile[]>([]);
  const [worker, setWorker] = useState<Worker>();

  useEffect(() => {
    setWorker(new Worker("/worker.js"));

    return () => {
      worker?.terminate();
    };
  }, []);

  useEffect(() => {
    async function handleWorkerMessage({
      data: { type, payload },
    }: WorkerEventMap["message"]) {
      if (type === "saveFile/callback") {
        const { fileId, blob } = payload;
        const file = timelineFiles.find((file) => file.id === fileId);

        if (!file) return;

        const stream = blob.stream();
        const fileStream = require("streamsaver").createWriteStream(file.name);
        stream.pipeTo(fileStream);
      }
    }

    worker?.addEventListener("message", handleWorkerMessage);
    return () => {
      worker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [worker, timelineFiles]);

  const rtcDataTransport = useMemo(
    () =>
      connection
        ? RTCDataTransport((chunk) => connection.write(chunk))
        : undefined,
    [connection]
  );

  useEventSubscription("exception/callPeer", (error) => {
    if (error.type === "deviceBusy") {
      toast.error("Requested device is busy");
    } else if (error.type === "callingSelf") {
      toast.error("Calling self is not allowed");
    } else if (error.type === "deviceNotFound") {
      toast.error("Device not found");
    }

    callerRef.current?.destroy();
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

  function call(peerID: number) {
    setPeerID(peerID);
    callerRef.current = new Peer({ initiator: true, trickle: false });
    setSignalingState("connecting");
  }

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

    function handleSignal(signal) {
      // Send caller's signal to the peer
      const peerId = peerID as number;
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

    const handleCallConnected = getCallConnectedHandler(callee);
    callee.on("connect", handleCallConnected);

    function handleSignal(signal) {
      const call = incomingCall as ICallData;
      const callerId = call.callerId;
      setPeerID(callerId);
      const answerCallPayload: ICallData = { callerId, signal };

      socket.emit("answerCall", answerCallPayload);
    }

    callee.on("signal", handleSignal);

    return () => {
      callee.off("connect", handleCallConnected);
      callee.off("signal", handleSignal);
    };
  }, [calleeRef.current]);

  function sendFile(file: File) {
    const fileId = uuid();
    const fileInfo: RTCTransportData<FileData> = {
      type: "fileTransport/fileData",
      payload: {
        id: fileId,
        name: file.name,
        size: file.size,
        progress: 0,
      },
    };
    rtcDataTransport?.send(fileInfo);

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

        rtcDataTransport?.send<RTCTransportData<FileData>>({
          type: "fileTransport/fileData",
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
      {
        ...(fileInfo.payload as FileData),
        direction: "up",
        chunkingId,
        isCancelled: false,
      },
    ]);
  }

  function saveFile(fileId: string) {
    worker?.postMessage({ type: "saveFile", payload: { fileId } });
  }

  function stopSendingFile(file: TimelineFile) {
    rtcDataTransport?.send({
      type: "fileTransport/sendingCancelled",
      payload: {
        fileId: file.id,
      },
    });

    // Stop chunking
    stopReadingInChunks(file.chunkingId as string);

    // Update timeline
    setTimelineFiles((timelineFiles) =>
      timelineFiles.map((timelineFile) =>
        timelineFile.id === file.id
          ? { ...timelineFile, isCancelled: true }
          : timelineFile
      )
    );
  }

  function stopReceivingFile(file: TimelineFile) {
    rtcDataTransport?.send<RTCTransportData>({
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

    function handleData(chunk) {
      rtcDataTransport?.handleData<RTCTransportData>(chunk, (data) => {
        if (data.type === "fileTransport/fileData") {
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
            worker?.postMessage({
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
          const file = timelineFiles.find(
            (timelineFile) => timelineFile.id === fileId
          );
          if (file) stopSendingFile(file);
        }
      });
    }

    function handleClose() {
      connection?.destroy();
      setConnection(undefined);
      setSignalingState("idle");
      toast.error("Connection has been closed");
    }

    function handleError(error) {
      if (error.code === "ERR_DATA_CHANNEL") {
        handleClose();
      }
    }

    connection.on("data", handleData);
    connection.on("error", handleError);
    connection.on("close", handleClose);

    return () => {
      connection.off("data", handleData);
      connection.off("error", handleError);
      connection.off("close", handleClose);
    };
  }, [worker, connection, timelineFiles, rtcDataTransport]);

  const value: WebRTCContextValue = {
    signalingState,
    timelineFiles,
    call,
    saveFile,
    stopSendingFile,
    stopReceivingFile,
    sendFile,
    peerID,
  };

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  );
};
