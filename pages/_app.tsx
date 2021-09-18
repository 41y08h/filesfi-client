import { ToastContainer } from "react-toastify";
import "../styles/globals.scss";
import "react-toastify/dist/ReactToastify.css";

function MyApp({ Component, pageProps }) {
  return (
    <div>
      <Component {...pageProps} />
      <ToastContainer position="bottom-center" />
    </div>
  );
}

export default MyApp;
