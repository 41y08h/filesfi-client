import Head from "next/head";
import { ImFinder } from "react-icons/im";
import Link from "next/link";
import Navbar from "./Navbar";

export default function Layout({ children }) {
  return (
    <div className="main bg-slate-400">
      <div className="bg-gray-200 min-h-screen pb-8 flex flex-col max-w-5xl mx-auto">
        <Navbar />
        {children}
      </div>
    </div>
  );
}
