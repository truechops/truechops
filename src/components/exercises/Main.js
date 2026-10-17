import PracticeCatalog from "../practice/PracticeCatalog";
import drumsetExercises from "../../../data/exercises/drumset/all";
import snareExercises from "../../../data/exercises/snare/all";

const categories = [
  { label: "Snare", rhythms: snareExercises },
  { label: "Drum set", rhythms: drumsetExercises },
];

export default function Main() {
  return <PracticeCatalog title="Drills" description="Find your focus. Practice control, coordination, and a little something new." categories={categories} drills />;
}
