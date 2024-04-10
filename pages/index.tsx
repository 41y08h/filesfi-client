import dynamic from "next/dynamic";
import Head from "next/head";

// @ts-expect-error
const Component = dynamic(() => import("../components/Home"), {
  ssr: false,
});

export default function Index(props) {
  return (
    <>
      <Head>
        <title>FilesFi - Share files with ease</title>
        <meta name="title" content="FilesFi - Share files with ease" />
        <meta
          name="description"
          content="Introducing FilesFi: Your Direct Link for Effortless File Sharing. Send documents, images, videos, and more directly from your device to theirs."
        />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://filesfi.netlify.app/" />
        <meta property="og:title" content="FilesFi - Share files with ease" />
        <meta
          property="og:description"
          content="Introducing FilesFi: Your Direct Link for Effortless File Sharing. Send documents, images, videos, and more directly from your device to theirs."
        />
        <meta
          property="og:image"
          content="https://filesfi.netlify.app/filesfi_cover.jpg"
        />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://filesfi.netlify.app/" />
        <meta
          property="twitter:title"
          content="FilesFi - Share files with ease"
        />
        <meta
          property="twitter:description"
          content="Introducing FilesFi: Your Direct Link for Effortless File Sharing. Send documents, images, videos, and more directly from your device to theirs."
        />
        <meta
          property="twitter:image"
          content="https://filesfi.netlify.app/filesfi_cover.jpg"
        />
      </Head>
      <Component {...props} />;
    </>
  );
}
