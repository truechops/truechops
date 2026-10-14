export default function SearchRedirect() { return null; }

export function getServerSideProps({ query }) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key,value]) => {
    (Array.isArray(value) ? value : [value]).forEach((entry) => params.append(key,entry));
  });
  const search = params.toString();
  return { redirect: { destination: `/discover${search ? `?${search}` : ""}`, permanent: false } };
}
