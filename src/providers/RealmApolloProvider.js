import { useSelector } from 'react-redux';
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  ApolloProvider,
} from "@apollo/client";

const createRealmApolloClient = (currentUser) => {
  const link = new HttpLink({
    uri: `/api/graphql`,
    fetch: async (uri, options = {}) => {
      const headers = { ...(options.headers || {}) };

      if (currentUser?.accessToken) {
        headers.Authorization = `Bearer ${currentUser.accessToken}`;
      }

      return fetch(uri, {
        ...options,
        credentials: "same-origin",
        headers,
      });
    },
  });
  const cache = new InMemoryCache();
  return new ApolloClient({ link, cache });
};

export default function RealmApolloProvider({ children }) {
  const currentUser = useSelector(state => state.realm.currentUser);
  const client = createRealmApolloClient(currentUser);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
