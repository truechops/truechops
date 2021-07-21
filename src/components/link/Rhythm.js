import { useRouter } from "next/router";
import { CircularProgress } from "@material-ui/core";
import { useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";

import { useLazyQuery } from "@apollo/client";

import { scrubTypename } from "../../helpers/mongodb";
import { GET_LINK_RHYTHM_BY_ID_QUERY } from '../../../consts/gql/graphql';
import { useEffect } from 'react';

export default function RhythmLink({ linkId }) {
  const dispatch = useDispatch();
  const router = useRouter();

  const [getLinkRhythm, { data: linkRhythm }] = useLazyQuery(
    GET_LINK_RHYTHM_BY_ID_QUERY
  );

  if (linkRhythm) {
    const { score, name, tempo } = scrubTypename(linkRhythm.getLinkRhythmById);
     dispatch(scoreActions.updateScore({ score, name, tempo }));
     router.push("/");
  }

  //Why does this have to be in useEffect???
  useEffect(() => {
    getLinkRhythm({ variables: { id: linkId } });
  }, [getLinkRhythm, linkId]);

  return <><CircularProgress /></>;
}
