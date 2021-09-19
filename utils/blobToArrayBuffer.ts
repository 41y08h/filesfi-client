export default async function blobToArrayBuffer(
  blob: Blob
): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(blob);
    reader.addEventListener("load", (event) => {
      const chunk = event.target.result as ArrayBuffer;
      resolve(chunk);
    });
  });
}
