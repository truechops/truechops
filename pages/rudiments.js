import dynamic from "next/dynamic";
import allExercises from '../../../data/rudiments/all';

const DynamicMain = dynamic(() => import("../src/components/exercises/Main"), {
  ssr: false,
});

export default function mine() {
  return <DynamicMain rhythms={allExercises}/>;
}
