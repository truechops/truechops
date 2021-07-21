import { useEffect, useState } from "react";
import rhythmMutations from "../../graphql/rhythm/useRhythmMutations";
import rhythmQueries from "../../graphql/useRhythmQueries";
import algoliasearch from 'algoliasearch';
import {InstantSearch, Hits} from 'react-instantsearch-dom';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';

const searchClient = algoliasearch(
  '7VD37OIZBX',
  '2a534bff416e726f1be43ec55ba52063'
);

export default function UserProfile() 
{
  const currentUser = useSelector((state) => state.realm.currentUser);
  const router = useRouter();

  //Don't allow the user to visit this page if they are not logged in.
  if(!currentUser) {
    router.push('/');
  }

  return (
    <section style={{textAlign: "center"}}>
      Profile
    </section>
  );
}
