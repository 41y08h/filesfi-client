import { useState, useRef, useMemo } from "react";
import FileInput from "../components/FileInput";
import { Dialog, Tab, Transition } from "@headlessui/react";
import { Fragment } from "react";
import formatFileSize from "../utils/formatFileSize";
import { GrSend } from "react-icons/gr";
import { FaFile } from "react-icons/fa6";
import { MdConnectWithoutContact, MdOutlineCancel } from "react-icons/md";
import ConnectingScreen from "../components/ConnectingScreen";
import ConnectScreen from "../components/ConnectScreen";
import TimelineFilesListItem from "../components/TimelineFilesListItem";
import { FaFolder } from "react-icons/fa";
import { CiFileOff } from "react-icons/ci";
import { useWebSocket } from "./WebSocketProvider";
import { useWebRTC } from "./WebRTCProvider";

export interface TimelineFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  direction: "up" | "down";
  chunkingId?: string;
  isCancelled: boolean;
}

export default function Home() {
  const { id, isSocketConnected } = useWebSocket();
  const {
    timelineFiles,
    signalingState,
    saveFile,
    stopReceivingFile,
    stopSendingFile,
    sendFile,
  } = useWebRTC();

  const sendButtonRef = useRef<HTMLButtonElement>();
  const [file, setFile] = useState<File>();
  const [isSendingModalOpen, setIsSendingModalOpen] = useState(false);

  const handleFileChange = (files: FileList) => {
    const file = files[0];
    setFile(file);
    if (file) setIsSendingModalOpen(true);
  };

  async function handleSendFile() {
    sendFile(file);
    setIsSendingModalOpen(false);
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

  if (!isSocketConnected) return <ConnectingScreen />;
  if (signalingState !== "connected") return <ConnectScreen />;
  if (signalingState === "connected")
    return (
      <div className="px-3 py-5 md:py-14 md:px-36 flex-grow flex flex-col">
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
              className="bg-gray-200 z-20 p-5 rounded-lg max-w-lg w-full overflow-hidden"
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
              <p className="bg-gray-900 text-white text- flex flex-col rounded-md p-3 pr-6 py-2 md:mr-3">
                <span className="text-xs">Your ID</span>
                <span>{id}</span>
              </p>
              <MdConnectWithoutContact className="text-3xl mx-4 md:hidden" />
              <p className="bg-gray-900 text-white flex flex-col items-end rounded-md p-3 pl-6 py-2">
                <span className="text-xs">Peer ID</span>
                <span>{id}</span>
              </p>
            </div>
          </div>
          <FileInput
            droppable
            style={{
              backgroundImage:
                "url(https://pics.craiyon.com/2023-10-27/26ac573724d9479b8b1d6a8d4424f23a.webp)",
              backgroundPosition: "center bottom",
            }}
            onChange={handleFileChange}
            className=" border-gray-300 text-white flex-1 overflow-hidden border py-8 px-4 rounded-lg flex justify-center items-center mt-4 md:mt-0 md:ml-4"
          >
            <span>
              <FaFile className="mr-2" />
            </span>
            <p className="overflow-hidden whitespace-nowrap text-ellipsis">
              {file ? file.name : "Select or drop files here"}
            </p>
          </FileInput>
        </div>
        <div className="mt-3 md:mt-5 bg-gray-100 border border-gray-400 rounded-lg flex-1">
          <div className="mb-2 font-light flex justify-center items-end border-b border-gray-300">
            <div className="flex items-center w-full px-4 py-2 text-lg rounded-t-lg bg-gray-300 justify-center md:justify-start">
              <FaFolder className="mr-2 text-blue-800" /> <span>Files</span>
            </div>
          </div>
          {timelineFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20">
              <CiFileOff className="text-3xl" />
              <span className="mt-2 text-sm">Empty</span>
            </div>
          )}
          <div className="px-2">
            {timelineFiles.map((file) => (
              <TimelineFilesListItem
                key={file.id}
                file={file}
                onSave={saveFile}
                onStopReceiving={stopReceivingFile}
                onStopSending={stopSendingFile}
              />
            ))}
          </div>
        </div>
      </div>
    );
}
