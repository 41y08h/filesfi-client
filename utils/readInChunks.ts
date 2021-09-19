import { v4 as uuid } from "uuid";
import blobToArrayBuffer from "./blobToArrayBuffer";

type ReadInChunksFn = (
  file: File,
  options?: {
    chunkSize?: number;
    onSuccess?: Function;
    onRead?: (chunk: ArrayBuffer, status: { progress: number }) => unknown;
  }
) => string;

let runningProcesses: string[] = [];

const readInChunks: ReadInChunksFn = (
  file,
  { chunkSize = 64 * 1000, onSuccess, onRead } = {}
) => {
  const processId = uuid();

  runningProcesses = [...runningProcesses, processId];
  readChunk();

  async function readChunk(startPosition = 0) {
    let isRunning = runningProcesses.includes(processId);

    const endPosition = startPosition + chunkSize;
    const blob = file.slice(startPosition, endPosition, file.type);
    const chunk = await blobToArrayBuffer(blob);
    isRunning = runningProcesses.includes(processId);
    if (!isRunning) return;

    const isDone = endPosition > file.size;
    const progress = isDone ? 100 : (endPosition / file.size) * 100;

    if (onRead) onRead(chunk, { progress });

    if (endPosition < file.size) readChunk(endPosition);
    else if (onSuccess) onSuccess();
  }

  return processId;
};

export function stopReadingInChunks(processId: string) {
  runningProcesses = runningProcesses.filter((id) => id !== processId);
}

export default readInChunks;
