import dynamic from "next/dynamic";

const Component = dynamic(() => import("./_index"), {
  ssr: false,
});

export default function Lib(props) {
  return <Component {...props} />;
}
