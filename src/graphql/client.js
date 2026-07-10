import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

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

export default createRealmApolloClient;
