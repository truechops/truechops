import dynamic from "next/dynamic";
export default dynamic(() => import("../src/components/social/Discover"), { ssr: false });
