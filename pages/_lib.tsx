import { useEffect, useState, useRef } from "react";
import Peer, { Instance as SimplePeerInstance } from "simple-peer";
import copy from "copy-to-clipboard";
import objectPath from "object-path";
import readObjectValues from "../utils/readObjectValues";
import deepcopy from "deepcopy";

const isInitiator = window.location.hash === "#1";

function RTCDataTransport(rtcSend: (chunk: any) => unknown) {
  let chunks = [];

  function combineDataChunks(chunks: any[]) {
    const schema = chunks[0];
    const values = chunks.slice(1);

    const object: Object = JSON.parse(schema);

    let valueIndex = 0;
    readObjectValues(object, (pathname, value) => {
      if (value === "$") {
        objectPath.set(object, pathname, values[valueIndex]);
        valueIndex++;
      }
    });
    return object;
  }

  function createDataChunks(object: Object) {
    const values = [];

    const schema = deepcopy(object);
    readObjectValues(schema, (pathname, value) => {
      // Number, String, Buffer, ArrayBufferView(...), ArrayBuffer
      const type = typeof value;
      if (type === "function")
        throw new TypeError("Functions are not supported.");
      if (type !== "object") return;

      const Constructors = [
        Buffer,
        Int8Array,
        Uint8Array,
        Uint8ClampedArray,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array,
        DataView,
      ];

      const supportedTypeMatched = Constructors.some((Constructor) => {
        if (value instanceof Constructor) {
          values.push(value);
          objectPath.set(schema, pathname, "$");

          // done
          return true;
        }
      });

      if (!supportedTypeMatched)
        throw new TypeError(
          `
Given schema contains unsupported types. Types must be one of: 
String, Number, Buffer, Int8Array, Uint8Array, Uint8ClampedArray, 
Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, 
Float64Array, DataView

Received type "${value.constructor.name}"
`.trim()
        );
    });

    return [JSON.stringify(schema), ...values];
  }

  function send(object: Object) {
    const chunks = createDataChunks(object);

    chunks.forEach((chunk) => rtcSend(chunk));
    rtcSend("chunks:done");
  }

  function handleData(chunk: any, onData: (data: Object) => unknown) {
    const isDone = chunk.toString() === "chunks:done";

    if (isDone) {
      const data = combineDataChunks(chunks);

      chunks = []; // Reset
      onData(data);
    } else {
      chunks.push(chunk);
    }
  }

  return { send, handleData };
}

export default function Lib() {
  const [signal, setSignal] = useState<RTCSessionDescription>();
  const [calleeSignal, setCalleeSignal] = useState<RTCSessionDescription>();
  const [signalingState, setSignalingState] = useState<"idle" | "connected">(
    "idle"
  );
  const [connection] = useState(
    new Peer({
      initiator: isInitiator,
      trickle: false,
    })
  );
  const rtcDataTransport = RTCDataTransport((chunk) => connection.write(chunk));

  useEffect(() => {
    window.connection = connection;

    function onConnect() {
      setSignalingState("connected");
    }
    function onClose() {
      setSignalingState("idle");
    }
    function onData(chunk) {
      rtcDataTransport.handleData(chunk, (data) => {
        console.log(data);
      });
    }

    connection.on("signal", setSignal);
    connection.on("connect", onConnect);
    connection.on("close", onClose);
    connection.on("data", onData);

    return () => {
      connection.off("signal", setSignal);
      connection.off("connect", onConnect);
      connection.off("close", onClose);
      connection.off("data", onData);
    };
  }, [setSignal]);

  function handleConnect() {
    connection.signal(calleeSignal);
  }

  function handleSend() {
    rtcDataTransport.send({
      type: "fileTransport/fileInfo",
      data: {
        file: new Uint8Array(new ArrayBuffer(5)),
        name: "sample_video.mp4",
      },
    });
  }

  return (
    <div className="App">
      {signal && (
        <button onClick={() => copy(JSON.stringify(signal))}>copy</button>
      )}
      <textarea
        onChange={(e) =>
          setCalleeSignal(new RTCSessionDescription(JSON.parse(e.target.value)))
        }
      />
      <button onClick={handleConnect}>Connect</button>
      <div>{signalingState}</div>
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
