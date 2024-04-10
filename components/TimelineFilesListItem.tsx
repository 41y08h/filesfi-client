import { FC } from "react";
import { FaFile } from "react-icons/fa";
import { TimelineFile } from "./Home";
import formatFileSize from "../utils/formatFileSize";
import { MdOutlineCancel } from "react-icons/md";
import { GoDownload } from "react-icons/go";

interface Props {
  file: TimelineFile;
  onStopSending: (file: TimelineFile) => any;
  onStopReceiving: (file: TimelineFile) => any;
  onSave: (id: string) => any;
}

const TimelineFilesListItem: FC<Props> = ({
  file,
  onSave,
  onStopReceiving,
  onStopSending,
}) => {
  const transportStatus = file.direction === "up" ? "Sent" : "Received";

  return (
    <div
      className="w-full border shadow rounded-lg bg-slate-100 mb-2.5"
      key={file.id}
    >
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <span className="bg-black text-white rounded-md p-2">
          <FaFile className="text-sm" />
        </span>
        <p
          title={file.name}
          className="text-sm ml-3 overflow-hidden text-ellipsis whitespace-nowrap w-full"
        >
          {file.name}
        </p>
        <small className="ml-2 flex-shrink-0">
          {formatFileSize(file.size)}
        </small>
      </div>

      <div className="p-2 px-3 flex justify-between bg-gray-200 h-9">
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
                    ? onStopSending(file)
                    : onStopReceiving(file)
                }
              >
                <MdOutlineCancel />
              </button>
            ) : (
              file.direction === "down" && (
                <button onClick={() => onSave(file.id)}>
                  <GoDownload />
                </button>
              )
            ))}
        </div>
      </div>
    </div>
  );
};

export default TimelineFilesListItem;
