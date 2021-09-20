import { useEffect, useState, useRef } from "react";
import Peer, { Instance as SimplePeerInstance } from "simple-peer";
import copy from "copy-to-clipboard";
import objectPath from "object-path";
import readObjectValues from "../utils/readObjectValues";
import deepcopy from "deepcopy";

const isInitiator = window.location.hash === "#1";

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
