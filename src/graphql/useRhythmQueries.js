import { useQuery } from "@apollo/client";
import { useSelector } from 'react-redux';
import gql from "graphql-tag";

export default function useRhythmQueries() {
  const currentUser = useSelector(state => state.realm.app.currentUser);
  const { rhythms, loading } = useAllRhythmsForUser(currentUser);
  return {
    rhythms,
    loading
  };
};

function useAllRhythmsForUser(currentUser) {
  const { data, loading, error } = useQuery(
    gql`
      query GetAllRhythmsForUser($userId: String!) {
        rhythms(query: { _userId: $userId }) {
          name
          notes {
            note,
            time
            velocity
          }
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
