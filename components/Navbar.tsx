import Link from "next/link";
import { ImFinder } from "react-icons/im";

export default function Navbar() {
  return (
    <nav className="px-5 md:px-8 py-5 font-light bg-gray-300">
      <ul className="flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center">
            <ImFinder className="text-blue-800 text-lg" />
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
