import { ApolloClient, InMemoryCache } from "@apollo/client";

const  createRealmApolloClient = (currentUser) => {
    const link = new HttpLink({
      // Realm apps use a standard GraphQL endpoint, identified by their App ID
      uri: `https://us-east-1.aws.realm.mongodb.com/api/client/v2.0/app/drumtoolz-ywire/graphql`,
      // A custom fetch handler adds the logged in user's access token to GraphQL requests
      fetch: async (uri, options) => {
        if (!currentUser) {
          throw new Error(`Must be logged in to use the GraphQL API`);
        }
        // Refreshing a user's custom data also refreshes their access token
        await currentUser.refreshCustomData();
        // The handler adds a bearer token Authorization header to the otherwise unchanged request
        options.headers.Authorization = `Bearer ${currentUser.accessToken}`;
        return fetch(uri, options);
      },
    });
    const cache = new InMemoryCache();
    return new ApolloClient({ link, cache });
  };