import { ObjectId } from "bson";
import { useMutation } from "@apollo/client";
import gql from "graphql-tag";
import { useSelector } from "react-redux";
import { rhythmSchema } from '../helpers/graphql';

export default function useRhythmMutations() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const score = useSelector(state => state.score.present.score);

  return {
    addRhythm: useAddRhythm(currentUser, score),
  };
}

const AddRhythmMutation = gql`
  mutation AddRhythm($rhythm: RhythmInsertInput!) {
    addedRhythm: insertOneRhythm(data: $rhythm) {
      ${rhythmSchema}
    }
  }
`;

const RhythmFragment = gql`
  fragment RhythmFragment on Rhythm {
    ${rhythmSchema}
  }
`;

function useAddRhythm(currentUser, score) {
  const [addRhythmMutation] = useMutation(AddRhythmMutation, {
    // Manually save added Tasks into the Apollo cache so that Task queries automatically update
    // For details, refer to https://www.apollographql.com/docs/react/data/mutations/#making-all-other-cache-updates
    update: (cache, { data: { addedRhythm } }) => {
      cache.modify({
        fields: {
          rhythms: (existingRhythms = []) => [
            ...existingRhythms,
            cache.writeFragment({
              data: addedRhythm,
              fragment: RhythmFragment,
            }),
          ],
        },
      });
    },
  });

  const addRhythm = async (name) => {
    const { addedRhythm } = await addRhythmMutation({
      variables: {
        rhythm: {
          _id: new ObjectId(),
          _userId: currentUser.id,
          name,
          score,
        },
      },
    });
    return addedRhythm;
  };

  return addRhythm;
}
