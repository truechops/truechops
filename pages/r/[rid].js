import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

export default function Link() {
    const DynamicMain = dynamic(
        () => import('../../src/components/link/Main'),
        { ssr: false }
      )
    
  const router = useRouter();
  const { rid } = router.query;

  return <DynamicMain linkId={rid} linkType="rhythm"/>
}