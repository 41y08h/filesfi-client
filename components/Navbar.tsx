import Link from "next/link";
import { ImFinder } from "react-icons/im";

export default function Navbar() {
  return (
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
  );
}
