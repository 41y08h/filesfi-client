import Link from "next/link";
import { ImFinder } from "react-icons/im";

export default function Navbar() {
  return (
    <nav className="w-full max-w-5xl h-16 px-5 py-4 md:px-8 font-light bg-gray-900 text-white ">
      <ul className="flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center">
            <ImFinder className="text-white text-lg" />
            <span className="ml-2 text-lg">FilesFi</span>
          </a>
        </Link>
        <Link href="/about">
          <a>About</a>
        </Link>
      </ul>
    </nav>
  );
}
