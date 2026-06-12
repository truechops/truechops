import dynamic from "next/dynamic";

const DynamicBookBuilder = dynamic(
  () => import("../src/components/book-builder/Main"),
  { ssr: false }
);

export default function BookBuilderPage() {
  return <DynamicBookBuilder />;
}
