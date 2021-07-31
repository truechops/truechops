import { ObjectId } from "bson";
import { useMutation } from "@apollo/client";
import { useSelector } from "react-redux";
import { ADD_RHYTHM_MUTATION, DELETE_RHYTHM_MUTATION, RHYTHM_FRAGMENT } from "../../consts/gql/graphql";

export default function useRhythmMutations() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const score = useSelector((state) => state.score.present.score);
  const tempo = useSelector((state) => state.score.present.tempo);
  const mutations = useSelector((state) => state.score.present.mutations);

  return {
    addRhythm: useAddRhythm(currentUser, score, tempo, mutations),
    deleteRhythm: useDeleteRhythm()
  };
}

function useAddRhythm(currentUser, score, tempo, mutations) {
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

  const addRhythm = async (name, type, saveMutations) => {
    const rhythm = {
      _id: new ObjectId(),
      _userId: currentUser.id,
      name,
      date: new Date(),
      score,
      tempo,
      type,
    };

    if (saveMutations) {
      rhythm.mutations = [
        {
          type: mutations[0].type,
          context: mutations[0].context,
          grid: mutations[0].grid,
          config: JSON.stringify(mutations[0].config),
        },
      ];
    } else {
      rhythm.mutations = [];
    }

    try {
      const {
        data: { addedRhythm },
      } = await addRhythmMutation({ variables: { rhythm } });

      return addedRhythm;
    } catch (err) {
      console.log("problem saving rhythm: " + err);
    }

    return null;
  };

  return addRhythm;
}

function useDeleteRhythm() {
  const [deleteRhythmMutation] = useMutation(DELETE_RHYTHM_MUTATION, {
    // Manually save added Tasks into the Apollo cache so that Task queries automatically update
    // For details, refer to https://www.apollographql.com/docs/react/data/mutations/#making-all-other-cache-updates
    // update: (cache, { data: { addedRhythm } }) => {
    //   cache.modify({
    //     fields: {
    //       rhythms: (existingRhythms = []) => [
    //         ...existingRhythms,
    //         cache.writeFragment({
    //           data: addedRhythm,
    //           fragment: RHYTHM_FRAGMENT,
    //         }),
    //       ],
    //     },
    //   });
     }
  );

  const deleteRhythm = async (id) => {
    try {
      const {
        data: { deletedRhythm }
      } = await deleteRhythmMutation({ variables: { id } });

      return deletedRhythm;
    } catch (err) {
      console.log("problem deleting rhythm: " + id + ": " + err);
    }

    return null;
  };

  return deleteRhythm;
}
