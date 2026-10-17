import PracticeCatalog from "../practice/PracticeCatalog";
import hybridRudiments from "../../../data/rudiments/hybrid/all";
import essentialRudiments from "../../../data/rudiments/essential/all";

const categories = [
  { label: "Essential", rhythms: essentialRudiments },
  { label: "Hybrid", rhythms: hybridRudiments },
];

export default function Main() {
  return <PracticeCatalog title="Rudiments" description="Build your foundation. Explore the essentials and find your next hybrid." categories={categories} />;
}
