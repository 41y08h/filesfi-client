import Head from "next/head";
import { ImFinder } from "react-icons/im";
import Link from "next/link";

export default function Layout({ children }) {
  return (
    <div className="main bg-slate-400">
      <div className="bg-gray-200 min-h-screen pb-8 flex flex-col max-w-5xl mx-auto">
        <div className="flex items-center justify-between px-8 py-5 font-light shadow-sm bg-gradient-to-t from-gray-300 to-gray-200">
          <Link href="/">
            <a className="flex items-center">
              <ImFinder className="text-blue-800 text-2xl" />
              <span className="ml-2 text-xl">FilesFi</span>
            </a>
          </Link>
          <nav>
            <Link href="/about">
              <a>About</a>
            </Link>
          </nav>
        </div>
        <Head>
          <title>FilesFi - Share files with ease</title>
        </Head>
        {children}
      </div>
    </div>
  );
}
