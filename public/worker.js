let array = [];

self.addEventListener("message", (event) => {
  if (event.data === "saveFile") {
    const blob = new Blob(array);
    self.postMessage(blob);
    array = [];
  } else if (event.data === "clearReceivedChunks") {
    array = [];
  } else {
    array.push(event.data);
  }
});
