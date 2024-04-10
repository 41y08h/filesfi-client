import "../styles/globals.css";
import Layout from "../components/Layout";
import { WebSocketProvider } from "../providers/WebSocketProvider";
import { WebRTCProvider } from "../providers/WebRTCProvider";

function App({ Component, pageProps }) {
  return (
    <WebSocketProvider>
      <WebRTCProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </WebRTCProvider>
    </WebSocketProvider>
  );
}

export default App;
