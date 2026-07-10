import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { ApolloServer } from "@apollo/server";
import { NextRequest } from "next/server";
import { gql } from "graphql-tag";
import { MongoClient } from 'mongodb'

import Rhythms from "../../src/graphql/data-sources/Rhythms";

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb+srv://jared:admin@cluster0.9ibeh.mongodb.net/drumtoolz')
client.connect()

const typeDefs = gql`
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello: () => "Hello world!",
  },
};

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

// Typescript: req has the type NextRequest
const handler = startServerAndCreateNextHandler(server, {
    context: async ({ req }) => {
        const token = req.headers.token;
        return {
          dataSources: {
            rhythms: new Rhythms({ modelOrCollection: client.db().collection('rhythms') })
          },
          token,
        };
      },
});

export { handler as GET, handler as POST };
