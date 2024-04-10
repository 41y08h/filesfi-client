import copy from "copy-to-clipboard";
import { FC, FormEventHandler, Ref, useRef } from "react";
import { FaGlobeAmericas, FaRegCopy } from "react-icons/fa";
import { useWebRTC } from "../providers/WebRTCProvider";
import { useWebSocket } from "../providers/WebSocketProvider";
import toast from "react-hot-toast";

const ConnectScreen: FC = () => {
  const { id } = useWebSocket();
  const { signalingState, call } = useWebRTC();
  const peerIdInputRef = useRef<HTMLInputElement>(null);

  function handleIdCopy() {
    if (!id) return;
    copy(id.toString());
    toast.success("Copied");
  }

  const handleSubmit: FormEventHandler = async (event) => {
    event.preventDefault();
    if (peerIdInputRef.current) call(parseInt(peerIdInputRef.current.value));
  };

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
};

export default ConnectScreen;
