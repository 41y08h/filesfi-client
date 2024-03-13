import { ToastContainer } from "react-toastify";
import "../styles/globals.css";
import "react-toastify/dist/ReactToastify.css";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <ToastContainer
        bodyClassName="text-sm"
        hideProgressBar
        bodyStyle={{ fontFamily: "Inter, sans-serif" }}
        position="bottom-center"
      />
    </>
  );
}

export default MyApp;
