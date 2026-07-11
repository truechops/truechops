import dynamic from "next/dynamic";

const DynamicQrLanding = dynamic(
  () => import("../../src/components/book-builder/QrLanding"),
  { ssr: false }
);

export default function QrPage({ token }) {
  return <DynamicQrLanding token={token} />;
}

export function getServerSideProps({ params, res }) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const token = String(params.token || "").trim();

  if (!token) {
    return { notFound: true };
  }

  return { props: { token } };
}
