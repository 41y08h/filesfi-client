type ReadInChunksFn = (
  file: File,
  options?: {
    chunkSize?: number;
    onSuccess?: Function;
    onRead?: (chunk: ArrayBuffer, status: { progress: number }) => unknown;
  }
) => void;

const readInChunks: ReadInChunksFn = (
  file,
  { chunkSize = 64 * 1000, onSuccess, onRead }
) => {
  readChunk();

  function readChunk(startPosition = 0) {
    const reader = new FileReader();

    const endPosition = startPosition + chunkSize;
    const nextStartPosition = endPosition;

    const blob = file.slice(startPosition, endPosition, file.type);

    reader.readAsArrayBuffer(blob);

    reader.addEventListener("load", (event) => {
      const chunk = event.target.result as ArrayBuffer;

      const progress =
        endPosition > file.size
          ? 100
          : Math.floor((endPosition / file.size) * 100);
      onRead && onRead(chunk, { progress });

      if (endPosition < file.size) readChunk(nextStartPosition);
      else onSuccess && onSuccess();
    });
  }
};

export default readInChunks;
