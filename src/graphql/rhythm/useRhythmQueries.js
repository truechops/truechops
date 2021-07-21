import { useQuery } from "@apollo/client";
import { useSelector } from 'react-redux';
import { GET_ALL_USER_RHYTHMS_QUERY, GET_RHYTHM_BY_ID_QUERY } from '../../../consts/gql/graphql';

export default function useRhythmQueries() {
  const currentUser = useSelector(state => state.realm.app.currentUser);
  return {
    getAllUserRhythms: useAllRhythmsForUser.bind(null, currentUser),
    getRhythmById: useGetRhythmById
  };
}

function useAllRhythmsForUser(currentUser) {
  const { data, loading, error } = useQuery(
    GET_ALL_USER_RHYTHMS_QUERY,
    { variables: { userId: currentUser.id } }
  );
  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  // If the query has finished, return the tasks from the result data
  // Otherwise, return an empty list
  const rhythms = data?.rhythms ?? [];
  return { rhythms, loading };
}

function useGetRhythmById(id) {
  const { data, loading, error } = useQuery(
    GET_RHYTHM_BY_ID_QUERY,
    { variables: { id } }
  );
  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }
  // If the query has finished, return the tasks from the result data
  // Otherwise, return an empty list
  const rhythm = data?.getRhythmById ?? [];
  return { rhythm, loading };
}