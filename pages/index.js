import dynamic from 'next/dynamic';

export default function Index() {
  const DynamicMain = dynamic(
    () => import('../src/components/compose/Main'),
    { ssr: false }
  )

  return (
    <DynamicMain />
  );
}
