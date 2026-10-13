import { useRouter } from "next/router";
import Link from "next/link";
import RhythmPost from "./RhythmPost";
import { Shell } from "./shared";
import styles from "./social.module.css";

export default function RhythmPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  return <Shell title="Practice & conversation" navigation={false}>
    <Link href="/discover" className={styles.back}>Back to the community</Link>
    <div className={styles.standalonePost}><RhythmPost key={id} id={id} /></div>
  </Shell>;
}
