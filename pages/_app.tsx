import { ToastContainer } from "react-toastify";
import "../styles/globals.css";
import "react-toastify/dist/ReactToastify.css";
import "react-tabs/style/react-tabs.css";
import Layout from "../components/Layout";
import { WebSocketProvider } from "../modules/WebSocketProvider";
import { WebRTCProvider } from "../modules/WebRTCProvider";

function MyApp({ Component, pageProps }) {
  return (
    <WebSocketProvider>
      <WebRTCProvider>
        <Layout>
          <Component {...pageProps} />
          <ToastContainer
            bodyClassName="text-sm"
            hideProgressBar
            bodyStyle={{ fontFamily: "Inter, sans-serif" }}
            position="bottom-center"
          />
        </Layout>
      </WebRTCProvider>
    </WebSocketProvider>
  );
}

export default MyApp;
