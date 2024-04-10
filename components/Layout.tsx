import Head from "next/head";
import Navbar from "./Navbar";
import dynamic from "next/dynamic";
import { Toaster } from "react-hot-toast";

const ParticlesBg = dynamic(() => import("particles-bg"), {
  ssr: false,
});

export default function Layout({ children }) {
  return (
    <div className="main">
      <ParticlesBg type="cobweb" bg />
      <Head>
        <title>FilesFi - Share files with ease</title>
      </Head>
      <div className="flex flex-col bg-gray-200 min-h-screen max-w-5xl mx-auto">
        <Navbar />
        {children}
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
