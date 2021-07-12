import { ObjectId } from "bson";
import { useMutation, } from "@apollo/client";
import { useSelector } from "react-redux";
import { ADD_RHYTHM_MUTATION, RHYTHM_FRAGMENT } from '../../data/graphql';

export default function useRhythmMutations() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const score = useSelector(state => state.score.present.score);

  return {
    addRhythm: useAddRhythm(currentUser, score),
  };
}

function useAddRhythm(currentUser, score) {
  const [addRhythmMutation] = useMutation(ADD_RHYTHM_MUTATION, {
    // Manually save added Tasks into the Apollo cache so that Task queries automatically update
    // For details, refer to https://www.apollographql.com/docs/react/data/mutations/#making-all-other-cache-updates
    update: (cache, { data: { addedRhythm } }) => {
      cache.modify({
        fields: {
          rhythms: (existingRhythms = []) => [
            ...existingRhythms,
            cache.writeFragment({
              data: addedRhythm,
              fragment: RHYTHM_FRAGMENT,
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
          date: new Date(),
          score,
        },
      },
    });
    return addedRhythm;
  };

  return addRhythm;
}
