import { useRouter } from "next/router";
import RhythmPost from "./RhythmPost";
import { Shell } from "./shared";

export default function RhythmPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  return <Shell title="Rhythm details">
    {id && <RhythmPost key={id} id={id} standalone onClose={() => router.push("/discover")} />}
  </Shell>;
}
