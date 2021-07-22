import { useQuery } from "@apollo/client";
import { GET_RHYTHM_LINK } from "../../consts/gql/graphql";
import { useSelector } from "react-redux";
import { ObjectId } from "bson";
import { LINK_TYPES } from "../../consts/db";

export default function useLinkQueries() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const score = useSelector((state) => state.score.present.score);
  const tempo = useSelector((state) => state.score.present.tempo);

  return {
    getRhythmLink: useGetRhythmLink.bind(null, currentUser, score, tempo),
  };
}

function useGetRhythmLink(currentUser, score, tempo, name) {
  const { data, loading, error } = useQuery(GET_RHYTHM_LINK, {
    variables: {
      rhythm: {
        _id: new ObjectId(),
        _userId: currentUser.id,
        name,
        date: new Date(),
        score,
        tempo,
        type: LINK_TYPES.rhythm,
      },
    },
  });

  const link = data ?? [];
  return { link, loading, error };
}
