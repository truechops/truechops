import dynamic from "next/dynamic";
export default dynamic(() => import("../../src/components/social/RhythmPage"), { ssr: false });
