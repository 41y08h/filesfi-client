const files = {};

self.addEventListener("message", (event) => {
  if (event.data.type === "fileChunk") {
    const { fileId, chunk } = event.data.payload;
    const isExisting = Boolean(files[fileId]);
    if (isExisting) files[fileId].push(chunk);
    else files[fileId] = [chunk];
  } else if (event.data.type === "saveFile") {
    const { fileId } = event.data.payload;

    const blob = new Blob(files[fileId]);
    self.postMessage({
      type: "saveFile/callback",
      payload: {
        fileId,
        blob,
      },
    });
  }
});
