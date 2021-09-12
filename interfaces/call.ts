type Signal = any;

export interface ICallData {
  callerId: number;
  signal: Signal;
}

export interface ICallInitData {
  peerId: number;
  signal: Signal;
}
