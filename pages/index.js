import dynamic from 'next/dynamic'
export default function Index() {
  const DynamicMain = dynamic(
    () => import('../src/components/compose/Main'),
    { ssr: false }
  )

  const DynamicScore = dynamic(
    () => import('../src/components/compose/Score'),
    { ssr: false }
  )
  return (
    <DynamicMain />
  );
}
