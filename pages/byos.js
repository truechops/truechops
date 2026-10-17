import dynamic from "next/dynamic";

const Byos = dynamic(() => import("../src/components/byos/Main"), { ssr: false });

export default function Main() {
  return <Byos />;
}
