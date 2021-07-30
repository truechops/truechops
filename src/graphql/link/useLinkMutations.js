import { useMutation } from "@apollo/client";
import { GET_RHYTHM_LINK, LINK_FRAGMENT } from "../../consts/gql/graphql";
import { LINK_TYPES } from '../../consts/db';
import { useSelector } from 'react-redux';
import { ObjectId } from "bson";

export default function useLinkMutations() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const score = useSelector((state) => state.score.present.score);
  const tempo = useSelector((state) => state.score.present.tempo);
  const mutations = useSelector((state) => state.score.present.mutations);

  return {
    getRhythmLink: useGetRhythmLink(currentUser, score, tempo, mutations)
  };
}

function useGetRhythmLink(currentUser, score, tempo, mutations) {
  const [addLinkMutation] = useMutation(GET_RHYTHM_LINK, {
    // Manually save added Tasks into the Apollo cache so that Task queries automatically update
    // For details, refer to https://www.apollographql.com/docs/react/data/mutations/#making-all-other-cache-updates
    update: (cache, { data: { addedLink } }) => {
      cache.modify({
        fields: {
          links: (existingLinks = []) => [
            ...existingLinks,
            cache.writeFragment({
              data: addedLink,
              fragment: LINK_FRAGMENT,
            }),
          ],
        },
      });
    },
  });

  const getLink = async (name, saveMutations) => {
    let ms = saveMutations ? [
      {
        type: mutations[0].type,
        context: mutations[0].context,
        grid: mutations[0].grid,
        config: JSON.stringify(mutations[0].config),
      },
    ] : null;
    console.log('mutations: ' + JSON.stringify(ms));
    try {
      const {
        data: { addedLink },
      } = await addLinkMutation({
        variables: {
          rhythm: {
            _id: new ObjectId(),
            _userId: currentUser.id,
            name,
            date: new Date(),
            score,
            tempo,
            type: LINK_TYPES.rhythm,
            mutations: ms
          },
        },
      });
      return addedLink;
    } catch (err) {
      console.log("Problem adding link: " + err);
    }

    return null;
  };

  return getLink;
}
