import dynamic from 'next/dynamic'

const DynamicMain = dynamic(() => import("../src/components/profile/Main"), {
    ssr: false,
  });

export default function profile() {
    return <DynamicMain />
}