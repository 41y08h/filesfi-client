import deepcopy from "deepcopy";
import objectPath from "object-path";
import readObjectValues from "./readObjectValues";

export interface RTCDataTransportInstance {
  send: <Data extends Object>(object: Data) => void;
  handleData: <Data>(chunk: any, onData: (data: Data) => unknown) => void;
}

export default function RTCDataTransport(
  rtcSend: (chunk: any) => unknown
): RTCDataTransportInstance {
  let chunks: any[] = [];

  function combineDataChunks(chunks: any[]) {
    const schema = chunks[0];
    const values = chunks.slice(1);

    const object = JSON.parse(schema);

    let valueIndex = 0;
    readObjectValues(object, (pathname, value) => {
      if (value === "$") {
        objectPath.set(object, pathname, values[valueIndex]);
        valueIndex++;
      }
    });
    return object;
  }

  function createDataChunks(object: Object) {
    const Constructors = [
      Buffer,
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
      DataView,
    ];

    const values: any[] = [];

    const schema = deepcopy(object);
    readObjectValues(schema, (pathname, value) => {
      // Number, String, Buffer, ArrayBufferView(...), ArrayBuffer
      const type = typeof value;
      if (type === "function")
        throw new TypeError("Functions are not supported.");
      if (type !== "object") return;

      const supportedTypeMatched = Constructors.some((Constructor) => {
        if (value instanceof Constructor) {
          values.push(value);
          // Replace with '$' where any one of `Constructors is present
          objectPath.set(schema, pathname, "$");

          // done
          return true;
        }
      });

      if (!supportedTypeMatched)
        throw new TypeError(
          `
  Given schema contains unsupported types. Types must be one of: 
  String, Number, Buffer, Int8Array, Uint8Array, Uint8ClampedArray, 
  Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, 
  Float64Array, DataView
  
  Received type "${value.constructor.name}"
  `.trim()
        );
    });

    return [JSON.stringify(schema), ...values];
  }

  function send<Data extends Object>(object: Data) {
    const chunks = createDataChunks(object);

    chunks.forEach((chunk) => rtcSend(chunk));
    rtcSend("chunks:done");
  }

  function handleData<Data>(chunk: any, onData: (data: Data) => unknown) {
    const isDone = chunk.toString() === "chunks:done";

    if (isDone) {
      const data = combineDataChunks(chunks);

      chunks = []; // Reset
      onData(data);
    } else {
      chunks.push(chunk);
    }
  }

  return { send, handleData };
}
