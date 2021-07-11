import { useState} from "react";
import { useDispatch } from 'react-redux';
import { scoreActions } from '../../store/score';
import rhythmQueries from "../../graphql/useRhythmQueries";
import { useRouter } from "next/router";

export default function Main() {
  const dispatch = useDispatch();
  const router = useRouter();

  const { userRhythms, getRhythmById } = rhythmQueries();
  async function practiceRhythm(id) {
      const rhythm = await getRhythmById(id);
        dispatch(scoreActions.updateScore(rhythm));
        router.push('/');
  }

  return (
    <section style={{textAlign: "center"}}>
      <h1>My Rhythms</h1>
      { 
        userRhythms.map(rhythm => <>
        <label>{rhythm.name}</label> <button onClick={practiceRhythm.bind(null, rhythm._id)}>Practice</button><br />
        </>)
        }
    </section>
  );
}
