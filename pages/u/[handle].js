import dynamic from "next/dynamic";
const Profile = dynamic(() => import("../../src/components/social/Profile"), { ssr: false });
export default function PublicProfile() { return <Profile publicView />; }
