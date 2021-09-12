let array = [];

self.addEventListener("message", (event) => {
  if (event.data === "downloadFile") {
    const blob = new Blob(array);
    self.postMessage(blob);
    array = [];
  } else {
    array.push(event.data);
  }
});
