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
  return (
    <section style={{textAlign: "center"}}>
      Profile
    </section>
  );
}

export default UserProfile;
