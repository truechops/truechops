import { useMutation } from "@apollo/client";
import { GET_RHYTHM_LINK, LINK_FRAGMENT } from "../../consts/gql/graphql";
import { LINK_TYPES } from '../../consts/db';
import { useSelector } from 'react-redux';
import { ObjectId } from "bson";

export default function useLinkMutations() {
  const currentUser = useSelector((state) => state.realm.currentUser);
  const score = useSelector((state) => state.score.present.score);
  const tempo = useSelector((state) => state.score.present.tempo);

  return {
    getRhythmLink: useGetRhythmLink(currentUser, score, tempo)
  };
}

function useGetRhythmLink(currentUser, score, tempo) {
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

  const getLink = async (name) => {
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
