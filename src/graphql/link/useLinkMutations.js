import { useMutation, } from "@apollo/client";
import { ADD_LINK_MUTATION, LINK_FRAGMENT } from '../../../consts/gql/graphql';
import { getLinkKey } from '../../helpers/link';

export default function useLinkMutations() {
  return {
    addLink: useAddLink()
  };
}

function useAddLink() {
  const [addLinkMutation] = useMutation(ADD_LINK_MUTATION, {
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

  const addLink = async (type, value) => {
    const { data: { addedLink } } = await addLinkMutation({
      variables: {
        link: {
          _id: getLinkKey(),
          type,
          value
        },
      },
    });
    return addedLink;
  };

  return addLink;
}
