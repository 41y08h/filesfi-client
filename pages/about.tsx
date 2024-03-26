import Head from "next/head";
import Image from "next/image";

export default function About() {
  return (
    <div className="p-8 pb-16">
      <Head>
        <title>About the project - FilesFi</title>
      </Head>
      <article className="flex flex-col max-w-xl mx-auto">
        <h1 className="text-center font-bold text-2xl mt-4">
          About the Project
        </h1>
        <div className="bg-white w-full mt-8 flex justify-center p-4 rounded-lg">
          <div className="w-full h-64 relative">
            <Image
              src="/webrtc.gif"
              layout="fill"
              objectFit="contain"
              alt="web-rtc"
            />
          </div>
        </div>
        <div className="mt-8">
          <small className="italic">14th March 2024</small>
          <div className="text-sm font-light">
            <p className="mt-2">
              This project was made to share files directly from one device to
              another through the use of WebRTC technology. It generates 6-digit
              unique ID for every connected device. The user can then share the
              ID with the other user to connect with them. Once the connection
              is established users can exchange unlimited number of files
              directly. This is similar to torrent in terms of its working
              principle. It can also be used to exchange big files.
            </p>
            <p className="mt-4">
              This is an OSS (Open Source Software) and its entire codebase can
              be found on Github. It&apos;s a webapp and there&apos;s a separate
              server and repository for{" "}
              <a
                target="_blank"
                rel="noreferrer"
                className="text-blue-800 underline"
                href="https://github.com/41y08h/filesfi-api"
              >
                backend
              </a>{" "}
              and{" "}
              <a
                target="_blank"
                rel="noreferrer"
                className="text-blue-800 underline"
                href="https://github.com/41y08h/filesfi-client"
              >
                frontend
              </a>
              .
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
