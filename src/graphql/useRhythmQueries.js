import { useQuery } from "@apollo/client";
import { useSelector } from 'react-redux';
import gql from "graphql-tag";

export default function useRhythmQueries() {
  const currentUser = useSelector(state => state.realm.app.currentUser);
  const { rhythms: userRhythms, loading } = useAllRhythmsForUser(currentUser);
  return {
    userRhythms,
    loading,
    getRhythmById: getRhythmById.bind(null, currentUser)
  };
}

function useAllRhythmsForUser(currentUser) {
  const { data, loading, error } = useQuery(
    gql`
      query GetAllRhythmsForUser($userId: String!) {
        rhythms(query: { _userId: $userId }) {
          _id
          name
        }
      }
    `,
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

async function getRhythmById(currentUser, rhythmId) {
  const rhythm = await currentUser.functions.findRhythmById(rhythmId);
  return rhythm.score;
}
