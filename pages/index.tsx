import io from "socket.io-client";
import { useState, useEffect, FormEventHandler, useRef } from "react";
import ICallPeerPayload from "../interfaces/ICallPeerPayload";
import IPeerIsCallingPayload from "../interfaces/IPeerIsCallingPayload";
import IAnswerCallPayload from "../interfaces/IAnswerCallPayload";
import Peer, { Instance } from "simple-peer";
import styles from "../styles/Home.module.scss";
import ID from "../components/ID";

const socket = io("http://192.168.0.105:5000");

function useEventSubscription(
  event: string,
  listener: (...args: any[]) => any
) {
  useEffect(() => {
    socket.on(event, listener);
    return () => {
      socket.off(event);
    };
  }, [event, listener]);
}

type CallState = "idle" | "calling" | "connected";

export default function Home() {
  const [id, setId] = useState<number>();
  const [callState, setCallState] = useState<CallState>("idle");
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const peerIdInputRef = useRef<HTMLInputElement>();
  const callerRef = useRef<Instance | undefined>();

  // WebSocket connectivity
  useEventSubscription("id", (id: number) => {
    setId(id);
    setIsSocketConnected(true);
  });

  useEventSubscription("disconnect", () => {
    setIsSocketConnected(false);
  });

  useEventSubscription("peerIsCalling", async (call: IPeerIsCallingPayload) => {
    const callee = new Peer({ trickle: false });

    // Set caller's signal
    callee.signal(call.signal);
    callee.on("connect", handleCallConnected);

    callee.on("signal", (signal) => {
      const callerId = call.callerId;
      const answerCallPayload: IAnswerCallPayload = { callerId, signal };

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
    caller.on("connect", handleCallConnected);

    setCallState("calling");

    caller.on("signal", (signal) => {
      // Send caller's signal to the peer
      const peerId = parseInt(peerIdInputRef.current.value);
      const callPayload: ICallPeerPayload = { peerId, signal };

      socket.emit("callPeer", callPayload);
    });
  };

  function handleCallConnected() {
    setCallState("connected");
  }

  return (
    <div className={styles.container}>
      {isSocketConnected && (
        <div>
          <p className={styles.idHeading}>Your ID</p>
          <ID id={id} />
          <div className={styles.innerContent}>
            {callState === "connected" && <p> 🔒 Connected</p>}
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
      )}
    </div>
  );
}
