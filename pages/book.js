import dynamic from "next/dynamic";

const DynamicPracticePage = dynamic(
  () => import("../src/components/book-builder/PagePractice"),
  { ssr: false }
);

export default function BookPractice() {
  return <DynamicPracticePage />;
}
