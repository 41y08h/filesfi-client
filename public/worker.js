let array = [];
const files = {};
let currentFileId;

self.addEventListener("message", (event) => {
  if (event.data.includes("currentFileId:")) {
    currentFileId = event.data.split(":")[1];
  } else if (event.data.includes("saveFile")) {
    const fileId = event.data.split(":")[1];

    const blob = new Blob(files[fileId]);
    self.postMessage({
      name: "saveFile",
      data: {
        fileId,
        blob,
      },
    });
  } else if (event.data === "clearReceivedChunks") {
    array = [];
  } else {
    const isExisting = Boolean(files[currentFileId]);
    if (isExisting) files[currentFileId].push(event.data);
    else files[currentFileId] = [event.data];
  }
});
