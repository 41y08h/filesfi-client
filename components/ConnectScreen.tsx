import copy from "copy-to-clipboard";
import { FC, FormEventHandler, Fragment, Ref, useRef, useState } from "react";
import { FaRegCopy } from "react-icons/fa";
import { useWebRTC } from "../providers/WebRTCProvider";
import { useWebSocket } from "../providers/WebSocketProvider";
import toast from "react-hot-toast";
import QRCode from "react-qr-code";
import { RiQrScan2Line } from "react-icons/ri";
import { Dialog, Transition } from "@headlessui/react";
import { RxCross2 } from "react-icons/rx";
import { ErrorBoundary } from "react-error-boundary";
import { QrReader } from "react-qr-reader";

const ConnectScreen: FC = () => {
  const { id } = useWebSocket();
  const { signalingState, call } = useWebRTC();
  const peerIdInputRef = useRef<HTMLInputElement>(null);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  function handleIdCopy() {
    if (!id) return;
    copy(id.toString());
    toast.success("Copied");
  }

  function toggleSendingModal() {
    setIsScannerModalOpen((t) => !t);
  }

  function startCall() {
    if (peerIdInputRef.current) call(parseInt(peerIdInputRef.current.value));
  }

  const handleSubmit: FormEventHandler = async (event) => {
    event.preventDefault();
    startCall();
  };

  return (
    <div className="p-8 flex-1 flex justify-center items-center">
      <Transition appear show={isScannerModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="fixed z-10 top-0 left-0 p-4 flex justify-center items-center h-screen w-screen"
          onClose={() => {}}
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
            className="bg-gray-200 z-20 p-5 rounded-lg max-w-lg w-full overflow-hidden relative"
            enter="transition-all duration-200 ease-in"
            enterFrom="opacity-0 scale-0"
            enterTo="opacity-100 scale-100"
            leave="transition-all duration-200 ease-out"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-0"
          >
            <button
              className="ml-auto absolute top-6 right-6"
              onClick={toggleSendingModal}
            >
              <RxCross2 />
            </button>
            <Dialog.Title className="flex items-center flex-col">
              <span className="font-bold text-center w-full mb-6">Scanner</span>
              <ErrorBoundary
                fallback={
                  <div className="bg-blue-700 text-white w-full flex flex-col rounded-lg p-4 px-8">
                    <span className="text-xl  font-bold">{":("}</span>
                    <span>Something went wrong</span>
                  </div>
                }
              >
                <QrReader
                  className="w-full"
                  videoStyle={{
                    width: "100%",
                    position: "static",
                  }}
                  videoContainerStyle={{
                    height: "auto",
                    paddingTop: "0",
                    borderRadius: "0.5rem",
                  }}
                  onResult={(data) => {
                    if (!isScannerModalOpen) return;
                    if (data == null) return;
                    const input = peerIdInputRef.current;
                    if (!input) return;
                    input.value = data.getText();
                    toggleSendingModal();
                    startCall();
                  }}
                  constraints={{ facingMode: "environment" }}
                />
              </ErrorBoundary>
            </Dialog.Title>
          </Transition.Child>
        </Dialog>
      </Transition>
      <div className="flex flex-col items-center md:flex-row md:justify-center">
        <div className="p-4 rounded-xl shadow-md bg-white mb-6 md:mb-0 md:mr-6">
          <QRCode value={id?.toString() || ""} className="w-36 h-auto" />
        </div>

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
            <div className="flex">
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
                type="button"
                className="rounded-lg border bg-gray-900 text-white p-2 px-3 ml-2"
                onClick={toggleSendingModal}
              >
                <RiQrScan2Line />
              </button>
            </div>
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
