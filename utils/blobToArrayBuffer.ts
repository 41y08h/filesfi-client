export default async function blobToArrayBuffer(
  blob: Blob
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", (event) => {
      const chunk = event.target.result as ArrayBuffer;
      resolve(chunk);
    });
    reader.addEventListener("error", (ev) => reject(ev.target.error));
    reader.readAsArrayBuffer(blob);
  });
}
