import dynamic from "next/dynamic";

const Component = dynamic(() => import("./_lib"), {
  ssr: false,
});

export default function Lib() {
  return <Component />;
}
