import { useState } from "react";
import rhythmMutations from "../../graphql/useRhythmMutations";
import rhythmQueries from "../../graphql/useRhythmQueries";
import algoliasearch from 'algoliasearch';
import {InstantSearch, Hits} from 'react-instantsearch-dom';

const searchClient = algoliasearch(
  '7VD37OIZBX',
  '2a534bff416e726f1be43ec55ba52063'
);

function UserProfile() {
  const [isLoading, setIsLoading] = useState(true);
  const {addRhythm} = rhythmMutations();

  const {rhythms} = rhythmQueries();

  const addRhythmHandler = () => {
    const addedRhythm = addRhythm("Jared's Rhythm", [
      { time: 0.3, note: "C5", velocity: 1 },
      { time: 1.2, note: "C5", velocity: 1 },
      { time: 0, note: "D4", velocity: 1 },
      { time: 0.6, note: "D4", velocity: 1 },
      { time: 0.9, note: "D4", velocity: 1 },
      { time: 0, note: "E5", velocity: 1 },
      { time: 0.2, note: "E5", velocity: 1 },
      { time: 0.25, note: "E5", velocity: 1 },
      { time: 0.3, note: "E5", velocity: 1 },
      { time: 0.35, note: "E5", velocity: 1 },
      { time: 0.4, note: "E5", velocity: 1 },
      { time: 0.6, note: "E5", velocity: 1 },
      { time: 0.8, note: "E5", velocity: 1 },
      { time: 1.1, note: "E5", velocity: 1 },
      { time: 1.2, note: "E5", velocity: 1 },
      { time: 1.4, note: "E5", velocity: 1 },
    ]);
    console.log(addRhythm);
  }

  return (
    <section style={{textAlign: "center"}}>
      <button onClick={addRhythmHandler}>Add Rhythm!</button>

      <h1>My Rhythms</h1>
      {rhythms.map(rhythm => <><label>{rhythm.name}</label><br /></>)}

      My Rhythms from algoliasearc
      <InstantSearch
      indexName="rhythms"
      searchClient={searchClient}
    >
      <Hits hitComponent={({ hit }) => <p>{hit.firstname} {hit.lastname}</p>} />
    </InstantSearch>
    </section>
  );
}

export default UserProfile;
