import dynamic from "next/dynamic";

const DynamicPracticePage = dynamic(
  () => import("../src/components/book-builder/BookPractice"),
  { ssr: false }
);

export default function BookPractice() {
  return <DynamicPracticePage />;
}
