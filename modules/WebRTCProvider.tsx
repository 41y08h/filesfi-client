import React, {
  createContext,
  FC,
  FormEventHandler,
  Ref,
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
import { toast } from "react-toastify";
import { TimelineFile } from ".";
import readInChunks, { stopReadingInChunks } from "../utils/readInChunks";
import { v4 as uuid } from "uuid";
import RTCDataTransport from "../utils/RTCDataTransport";

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

interface WebRTCContext {
  signalingState: SignalingState;
  timelineFiles: TimelineFile[];
  call: (peerID: number) => any;
  sendFile: (file: File) => any;
  saveFile: (fileId: string) => any;
  stopSendingFile: (file?: TimelineFile) => any;
  stopReceivingFile: (file?: TimelineFile) => any;
}

const WebRTCContext = createContext(undefined);

export function useWebRTC(): WebRTCContext {
  return useContext(WebRTCContext);
}

export const WebRTCProvider: FC = ({ children }) => {
  const [peerID, setPeerID] = useState<number>(null);
  const [signalingState, setSignalingState] = useState<SignalingState>("idle");
  const callerRef = useRef<SimplePeerInstance>();
  const calleeRef = useRef<SimplePeerInstance>();
  const [incomingCall, setIncomingCall] = useState<ICallData>();
  const [connection, setConnection] = useState<SimplePeerInstance>();

  const [timelineFiles, setTimelineFiles] = useState<TimelineFile[]>([]);

  const workerRef = useRef<Worker>();

  useEffect(() => {
    workerRef.current = new Worker("/worker.js");

    async function handleWorkerMessage(event) {
      if (event.data.type === "saveFile/callback") {
        const { fileId, blob } = event.data.payload;
        const file = timelineFiles.find((file) => file.id === fileId);

        if (!file) return;

        const stream = blob.stream();
        const fileStream = require("streamsaver").createWriteStream(file.name);
        stream.pipeTo(fileStream);
      }
    }

    workerRef.current.addEventListener("message", handleWorkerMessage);

    return () => {
      workerRef.current?.terminate();
    };
  }, [timelineFiles]);

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

  // Handler signaling
  function handleSignal(signal) {
    // Send caller's signal to the peer
    const peerId = parseInt(peerID.toString());
    const callPayload: ICallInitData = { peerId, signal };

    socket.emit("callPeer", callPayload);
  }

  useEffect(() => {
    const caller = callerRef.current;
    if (!caller) return;

    // Handler call connection
    const handleCallConnected = getCallConnectedHandler(caller);
    caller.on("connect", handleCallConnected);

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

  function sendFile(file: File) {
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
  }

  function saveFile(fileId: string) {
    workerRef.current.postMessage({ type: "saveFile", payload: { fileId } });
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

    function handleData(chunk) {
      rtcDataTransport.handleData<RTCTransportData>(chunk, (data) => {
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
            workerRef.current.postMessage({
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

    return () => {
      connection.off("data", handleData);
      connection.off("error", handleError);
      connection.off("close", handleClose);
    };
  }, [workerRef.current, connection, timelineFiles, rtcDataTransport]);

  const value: WebRTCContext = {
    signalingState,
    timelineFiles,
    call,
    saveFile,
    stopSendingFile,
    stopReceivingFile,
    sendFile,
  };

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  );
};
