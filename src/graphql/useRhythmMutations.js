import { ObjectId } from "bson";
import { useMutation } from "@apollo/client";
import gql from "graphql-tag";
import { useSelector } from 'react-redux';

export default function useRhythmMutations() {
  const currentUser = useSelector(state => state.realm.currentUser);

  return {
    addRhythm: useAddRhythm(currentUser)
  };
}

const AddRhythmMutation = gql`
  mutation AddRhythm($rhythm: RhythmInsertInput!) {
    addedRhythm: insertOneRhythm(data: $rhythm) {
      _userId
      _id
      name
      notes {
        velocity
        time
        note
      }
    }
  }
`;

const RhythmFragment = gql`
  fragment RhythmFragment on Rhythm {
    _userId
    _id
    name
    notes {
      velocity
      time
      note
    }
  }
`;

function useAddRhythm(currentUser) {
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
  
  const addRhythm = async (name, notes) => {
    const { addedRhythm } = await addRhythmMutation({
      variables: {
        rhythm: {
          _id: new ObjectId(),
          _userId: currentUser.id,
          name,
          notes
        },
      },
    });
    return addedRhythm;
  };

  return addRhythm;
}
