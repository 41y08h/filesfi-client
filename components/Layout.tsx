import Head from "next/head";
import Navbar from "./Navbar";

export default function Layout({ children }) {
  return (
    <div className="main bg-gray-200">
      <Head>
        <title>FilesFi - Share files with ease</title>
      </Head>
      <div className="flex flex-col bg-gray-200 min-h-screen max-w-5xl mx-auto">
        <Navbar />
        {children}
      </div>
    </div>
  );
}
