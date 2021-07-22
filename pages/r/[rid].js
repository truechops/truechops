import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { LINK_TYPES } from '../../src/consts/db';

export default function Link() {
    const DynamicMain = dynamic(
        () => import('../../src/components/link/Main'),
        { ssr: false }
      )
    
  const router = useRouter();
  const { rid } = router.query;

  return <DynamicMain linkId={rid} linkType={ LINK_TYPES.rhythm }/>
}