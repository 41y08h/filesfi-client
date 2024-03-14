import { ToastContainer } from "react-toastify";
import "../styles/globals.css";
import "react-toastify/dist/ReactToastify.css";
import Layout from "../components/Layout";

function MyApp({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
      <ToastContainer
        bodyClassName="text-sm"
        hideProgressBar
        bodyStyle={{ fontFamily: "Inter, sans-serif" }}
        position="bottom-center"
      />
    </Layout>
  );
}

export default MyApp;
