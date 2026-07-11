export default function LegacyBookPagePractice() {
  return null;
}

export function getServerSideProps({ res }) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  return {
    redirect: {
      destination: "/book",
      permanent: false,
    },
  };
}
