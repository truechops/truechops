import { useQuery } from "@apollo/client";
import { GET_LINK_RHYTHM_BY_ID_QUERY, GET_RHYTHM_BY_ID_QUERY } from '../../../consts/gql/graphql';

export default function useLinkQueries() {
  return {
    getLinkRhythmById: useGetLinkRhythmById
  };
}

function useGetLinkRhythmById(id) {
  const { data, loading, error } = useQuery(
    GET_LINK_RHYTHM_BY_ID_QUERY,
    { variables: { id } }
  );
  if (error) {
    console.log('error');
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }
  console.log('link data: ' + JSON.stringify(data));
  // If the query has finished, return the tasks from the result data
  // Otherwise, return an empty list
  const rhythm = data?.getLinkRhythmById ?? [];
  return { rhythm, loading };
}