import dynamic from 'next/dynamic'

const DynamicMain = dynamic(
    () => import('../src/components/library/Main'),
    { ssr: false }
  )

export default function mine() {
    return <DynamicMain />
}