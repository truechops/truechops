import dynamic from "next/dynamic";

const DynamicComposer = dynamic(
  () => import("../src/components/compose/Main"),
  { ssr: false }
);

export default function BookBuilderPage() {
  return <DynamicComposer initialTab={4} />;
}
