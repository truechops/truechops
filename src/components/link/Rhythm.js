import { useRouter } from "next/router";
import { CircularProgress } from "@mui/material";
import { useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";

import { useLazyQuery } from "@apollo/client";

import { scrubTypename } from "../../helpers/mongodb";
import { GET_LINK_RHYTHM_BY_ID_QUERY } from '../../consts/gql/graphql';
import { useEffect } from 'react';
import { useTheme } from '@mui/styles';

export default function RhythmLink({ linkId }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const theme = useTheme();

  const [getLinkRhythm, { data: linkRhythm, error }] = useLazyQuery(
    GET_LINK_RHYTHM_BY_ID_QUERY
  );

  if (linkRhythm) {
    const { score, name, tempo, mutations } = scrubTypename(linkRhythm.getLinkRhythmById);
     dispatch(scoreActions.updateScore({ score, name, tempo, mutations }));
     router.push("/");
  } else if(error) {
    router.push('/');
  }

  //Why does this have to be in useEffect???
  useEffect(() => {
    getLinkRhythm({ variables: { id: linkId } });
  }, [getLinkRhythm, linkId]);

  return <><CircularProgress style={theme.spinner}/></>;
}
