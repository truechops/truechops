import dynamic from "next/dynamic";

const DynamicPracticePage = dynamic(
  () => import("../../../src/components/book-builder/PagePractice"),
  { ssr: false }
);

export default function BookPagePractice({ pageNumber }) {
  return <DynamicPracticePage pageNumber={pageNumber} />;
}

export function getServerSideProps({ params }) {
  const pageNumber = Number(params.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return { notFound: true };
  }
  return { props: { pageNumber } };
}
