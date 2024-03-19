import { FaConnectdevelop } from "react-icons/fa";

export default function ConnectingScreen() {
  return (
    <div className="flex-1 flex justify-center items-center">
      <div className="flex flex-col items-center justify-center">
        <FaConnectdevelop className="text-4xl mb-2" />
        Connecting...
      </div>
    </div>
  );
}
