import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { ApolloServer } from "@apollo/server";
import { NextRequest } from "next/server";
import { gql } from "graphql-tag";
import { ConnectionClosedEvent, MongoClient, ObjectId } from 'mongodb'
import { GraphQLScalarType, Kind } from 'graphql';

import Rhythms from "../../src/graphql/data-sources/Rhythms";

const client = new MongoClient('mongodb+srv://jared:admin@cluster0.9ibeh.mongodb.net/drumtoolz')

client.connect()

const typeDefs = gql`
  input RhythmScorePartInsertInput {
  cymbals: RhythmScorePartCymbalInsertInput
  drumset: RhythmScorePartDrumsetInsertInput
  snare: RhythmScorePartSnareInsertInput
  tenors: RhythmScorePartTenorInsertInput
  bass: RhythmScorePartBassInsertInput
}

input RhythmMutationUpdateInput {
  grid_unset: Boolean
  type_unset: Boolean
  config: String
  type: String
  grid: Int
  config_unset: Boolean
  grid_inc: Int
  context: String
  context_unset: Boolean
}

input RhythmScorePartDrumsetUpdateInput {
  enabled: Boolean
  enabled_unset: Boolean
}

type Query {
  getLinkRhythmById(input: String): Rhythm
  getRhythmById(input: String): Rhythm
  link(query: LinkQueryInput): Link
  links(sortBy: LinkSortByInput, query: LinkQueryInput, limit: Int = 100): [Link]!
  rhythm(query: RhythmQueryInput): Rhythm
  rhythms(query: RhythmQueryInput, limit: Int = 100, sortBy: RhythmSortByInput): [Rhythm]!
}

type Rhythm {
  _id: String!
  _userId: String!
  date: DateTime!
  mutations: [RhythmMutation]
  name: String!
  score: RhythmScore!
  tempo: Float
  type: String
}

input RhythmScoreMeasurePartVoiceTupletQueryInput {
  normal_in: [Int]
  start_lte: Int
  actual_lt: Int
  normal_gte: Int
  end_lt: Int
  start_ne: Int
  end_nin: [Int]
  start_lt: Int
  end_lte: Int
  normal_ne: Int
  actual_gt: Int
  actual_lte: Int
  actual_ne: Int
  OR: [RhythmScoreMeasurePartVoiceTupletQueryInput!]
  end: Int
  end_exists: Boolean
  end_gt: Int
  end_gte: Int
  normal_nin: [Int]
  start_nin: [Int]
  AND: [RhythmScoreMeasurePartVoiceTupletQueryInput!]
  end_in: [Int]
  normal_lt: Int
  normal_lte: Int
  end_ne: Int
  actual_gte: Int
  actual_in: [Int]
  start_gt: Int
  actual_exists: Boolean
  start_exists: Boolean
  start: Int
  start_in: [Int]
  normal_exists: Boolean
  actual: Int
  actual_nin: [Int]
  normal: Int
  normal_gt: Int
  start_gte: Int
}

input RhythmScoreMeasureTimeSigInsertInput {
  type: Int
  num: Int
}

input RhythmScorePartCymbalUpdateInput {
  enabled_unset: Boolean
  enabled: Boolean
}

input RhythmScorePartSnareQueryInput {
  enabled: Boolean
  enabled_ne: Boolean
  enabled_exists: Boolean
  AND: [RhythmScorePartSnareQueryInput!]
  OR: [RhythmScorePartSnareQueryInput!]
}

input RhythmScoreMeasurePartVoiceQueryInput {
  notes_nin: [RhythmScoreMeasurePartVoiceNoteQueryInput]
  tuplets_in: [RhythmScoreMeasurePartVoiceTupletQueryInput]
  AND: [RhythmScoreMeasurePartVoiceQueryInput!]
  notes_in: [RhythmScoreMeasurePartVoiceNoteQueryInput]
  tuplets: [RhythmScoreMeasurePartVoiceTupletQueryInput]
  tuplets_exists: Boolean
  OR: [RhythmScoreMeasurePartVoiceQueryInput!]
  notes: [RhythmScoreMeasurePartVoiceNoteQueryInput]
  notes_exists: Boolean
  tuplets_nin: [RhythmScoreMeasurePartVoiceTupletQueryInput]
}

input RhythmScorePartSnareUpdateInput {
  enabled: Boolean
  enabled_unset: Boolean
}

type Link {
  _id: String!
  type: String!
  value: String!
}

type RhythmScoreMeasurePart {
  instrument: String
  voices: [RhythmScoreMeasurePartVoice]
}

input RhythmScoreMeasurePartVoiceNoteQueryInput {
  AND: [RhythmScoreMeasurePartVoiceNoteQueryInput!]
  velocity_gte: Float
  ornaments_in: [String]
  head_gte: String
  velocity_nin: [Float]
  velocity: Float
  dots_nin: [Int]
  notes_nin: [String]
  head_gt: String
  duration_in: [Int]
  duration_gte: Int
  velocity_ne: Float
  velocity_gt: Float
  dots_lte: Int
  head_lt: String
  head_ne: String
  duration_ne: Int
  head_in: [String]
  head_nin: [String]
  duration_exists: Boolean
  dots_gte: Int
  duration_gt: Int
  velocity_in: [Float]
  duration: Int
  ornaments_ne: String
  head_exists: Boolean
  ornaments: String
  ornaments_gte: String
  dots_lt: Int
  dots_gt: Int
  ornaments_exists: Boolean
  OR: [RhythmScoreMeasurePartVoiceNoteQueryInput!]
  ornaments_gt: String
  dots: Int
  velocity_lte: Float
  ornaments_lt: String
  duration_lt: Int
  duration_lte: Int
  notes_in: [String]
  ornaments_lte: String
  duration_nin: [Int]
  head: String
  head_lte: String
  dots_in: [Int]
  velocity_lt: Float
  notes: [String]
  dots_ne: Int
  notes_exists: Boolean
  velocity_exists: Boolean
  ornaments_nin: [String]
  dots_exists: Boolean
}

input RhythmUpdateInput {
  name_unset: Boolean
  _userId: String
  score_unset: Boolean
  _id: String
  type_unset: Boolean
  mutations: [RhythmMutationUpdateInput]
  type: String
  date_unset: Boolean
  mutations_unset: Boolean
  _id_unset: Boolean
  _userId_unset: Boolean
  name: String
  tempo_unset: Boolean
  date: DateTime
  score: RhythmScoreUpdateInput
  tempo_inc: Float
  tempo: Float
}

scalar DateTime

type RhythmScoreMeasureTimeSig {
  num: Int
  type: Int
}

input RhythmQueryInput {
  tempo_ne: Float
  _userId_lt: String
  mutations: [RhythmMutationQueryInput]
  type_nin: [String]
  date_lt: DateTime
  mutations_in: [RhythmMutationQueryInput]
  _id_lte: String
  name_gt: String
  name_ne: String
  date_exists: Boolean
  tempo_exists: Boolean
  name_lte: String
  tempo_lt: Float
  _id_lt: String
  type_gt: String
  _userId: String
  AND: [RhythmQueryInput!]
  type_gte: String
  mutations_nin: [RhythmMutationQueryInput]
  name_nin: [String]
  type_exists: Boolean
  _id_in: [String]
  type_ne: String
  tempo_lte: Float
  OR: [RhythmQueryInput!]
  _id_gte: String
  date_gte: DateTime
  _userId_in: [String]
  _id_ne: String
  name_in: [String]
  date_nin: [DateTime]
  _userId_exists: Boolean
  date: DateTime
  _userId_gt: String
  _userId_lte: String
  type_in: [String]
  tempo_gt: Float
  name: String
  type: String
  score: RhythmScoreQueryInput
  tempo_gte: Float
  _id: String
  mutations_exists: Boolean
  type_lt: String
  date_lte: DateTime
  tempo_nin: [Float]
  tempo: Float
  type_lte: String
  score_exists: Boolean
  _id_gt: String
  _userId_gte: String
  name_gte: String
  name_lt: String
  _userId_nin: [String]
  name_exists: Boolean
  _id_nin: [String]
  _id_exists: Boolean
  _userId_ne: String
  date_gt: DateTime
  tempo_in: [Float]
  date_in: [DateTime]
  date_ne: DateTime
}

input RhythmScorePartDrumsetQueryInput {
  AND: [RhythmScorePartDrumsetQueryInput!]
  enabled: Boolean
  enabled_ne: Boolean
  enabled_exists: Boolean
  OR: [RhythmScorePartDrumsetQueryInput!]
}

input RhythmScoreMeasurePartVoiceInsertInput {
  notes: [RhythmScoreMeasurePartVoiceNoteInsertInput]
  tuplets: [RhythmScoreMeasurePartVoiceTupletInsertInput]
}

input RhythmScoreMeasurePartVoiceNoteInsertInput {
  dots: Int
  notes: [String]
  ornaments: String
  duration: Int
  head: String
  velocity: Float
}

input RhythmScorePartSnareInsertInput {
  enabled: Boolean
}

input RhythmScorePartTenorUpdateInput {
  enabled: Boolean
  enabled_unset: Boolean
}

type RhythmScore {
  measures: [RhythmScoreMeasure]
  parts: RhythmScorePart
}

type RhythmScorePartBass {
  enabled: Boolean
}

input RhythmScorePartCymbalQueryInput {
  enabled_ne: Boolean
  enabled_exists: Boolean
  AND: [RhythmScorePartCymbalQueryInput!]
  OR: [RhythmScorePartCymbalQueryInput!]
  enabled: Boolean
}

input RhythmMutationQueryInput {
  type_in: [String]
  context_ne: String
  context_in: [String]
  type_gte: String
  type_nin: [String]
  grid_lt: Int
  config_gt: String
  OR: [RhythmMutationQueryInput!]
  type_lte: String
  context_gte: String
  config_nin: [String]
  config_exists: Boolean
  grid_gte: Int
  context: String
  type_exists: Boolean
  config_lte: String
  type_gt: String
  context_nin: [String]
  config_in: [String]
  config_ne: String
  grid_gt: Int
  context_gt: String
  type_ne: String
  context_exists: Boolean
  grid: Int
  config: String
  type_lt: String
  grid_exists: Boolean
  grid_ne: Int
  context_lte: String
  AND: [RhythmMutationQueryInput!]
  grid_lte: Int
  type: String
  grid_nin: [Int]
  grid_in: [Int]
  config_lt: String
  context_lt: String
  config_gte: String
}

scalar ObjectId

input RhythmScorePartBassInsertInput {
  enabled: Boolean
}

input RhythmScorePartDrumsetInsertInput {
  enabled: Boolean
}

input RhythmScoreUpdateInput {
  measures_unset: Boolean
  parts: RhythmScorePartUpdateInput
  parts_unset: Boolean
  measures: [RhythmScoreMeasureUpdateInput]
}

enum LinkSortByInput {
  _ID_ASC
  _ID_DESC
  TYPE_ASC
  TYPE_DESC
  VALUE_ASC
  VALUE_DESC
}

input LinkQueryInput {
  value_lt: String
  _id_exists: Boolean
  type_gte: String
  AND: [LinkQueryInput!]
  type_in: [String]
  type_exists: Boolean
  _id_in: [String]
  _id_lte: String
  type_lt: String
  value_ne: String
  value_gt: String
  value_gte: String
  type: String
  _id_gte: String
  type_nin: [String]
  type_gt: String
  value: String
  value_exists: Boolean
  _id_nin: [String]
  _id_gt: String
  value_in: [String]
  type_ne: String
  OR: [LinkQueryInput!]
  _id_lt: String
  value_nin: [String]
  _id_ne: String
  type_lte: String
  value_lte: String
  _id: String
}

type RhythmScoreMeasurePartVoice {
  notes: [RhythmScoreMeasurePartVoiceNote]
  tuplets: [RhythmScoreMeasurePartVoiceTuplet]
}

input RhythmScoreMeasureQueryInput {
  parts_in: [RhythmScoreMeasurePartQueryInput]
  parts_nin: [RhythmScoreMeasurePartQueryInput]
  parts_exists: Boolean
  OR: [RhythmScoreMeasureQueryInput!]
  AND: [RhythmScoreMeasureQueryInput!]
  timeSig: RhythmScoreMeasureTimeSigQueryInput
  timeSig_exists: Boolean
  parts: [RhythmScoreMeasurePartQueryInput]
}

enum RhythmSortByInput {
  TYPE_DESC
  NAME_ASC
  NAME_DESC
  DATE_ASC
  _USERID_DESC
  _ID_ASC
  _ID_DESC
  TYPE_ASC
  TEMPO_ASC
  _USERID_ASC
  DATE_DESC
  TEMPO_DESC
}

input RhythmScoreMeasurePartVoiceNoteUpdateInput {
  head_unset: Boolean
  velocity_inc: Float
  duration_inc: Int
  ornaments: String
  ornaments_unset: Boolean
  velocity_unset: Boolean
  duration_unset: Boolean
  dots_inc: Int
  notes: [String]
  dots: Int
  head: String
  dots_unset: Boolean
  notes_unset: Boolean
  duration: Int
  velocity: Float
}

type Mutation {
  deleteManyLinks(query: LinkQueryInput): DeleteManyPayload
  deleteManyRhythms(query: RhythmQueryInput): DeleteManyPayload
  deleteOneLink(query: LinkQueryInput!): Link
  deleteOneRhythm(query: RhythmQueryInput!): Rhythm
  getRhythmLink(input: RhythmInsertInput): String
  insertManyLinks(data: [LinkInsertInput!]!): InsertManyPayload
  insertManyRhythms(data: [RhythmInsertInput!]!): InsertManyPayload
  insertOneLink(data: LinkInsertInput!): Link
  insertOneRhythm(data: RhythmInsertInput!): Rhythm
  replaceOneLink(query: LinkQueryInput, data: LinkInsertInput!): Link
  replaceOneRhythm(query: RhythmQueryInput, data: RhythmInsertInput!): Rhythm
  updateManyLinks(query: LinkQueryInput, set: LinkUpdateInput!): UpdateManyPayload
  updateManyRhythms(query: RhythmQueryInput, set: RhythmUpdateInput!): UpdateManyPayload
  updateOneLink(query: LinkQueryInput, set: LinkUpdateInput!): Link
  updateOneRhythm(query: RhythmQueryInput, set: RhythmUpdateInput!): Rhythm
  upsertOneLink(data: LinkInsertInput!, query: LinkQueryInput): Link
  upsertOneRhythm(data: RhythmInsertInput!, query: RhythmQueryInput): Rhythm
}

input RhythmScoreMeasurePartInsertInput {
  instrument: String
  voices: [RhythmScoreMeasurePartVoiceInsertInput]
}

input RhythmScorePartCymbalInsertInput {
  enabled: Boolean
}

input RhythmScorePartUpdateInput {
  drumset_unset: Boolean
  bass: RhythmScorePartBassUpdateInput
  bass_unset: Boolean
  snare: RhythmScorePartSnareUpdateInput
  snare_unset: Boolean
  tenors_unset: Boolean
  cymbals_unset: Boolean
  drumset: RhythmScorePartDrumsetUpdateInput
  tenors: RhythmScorePartTenorUpdateInput
  cymbals: RhythmScorePartCymbalUpdateInput
}

type RhythmScoreMeasurePartVoiceNote {
  dots: Int
  duration: Int
  head: String
  notes: [String]
  ornaments: String
  velocity: Float
}

input RhythmScoreQueryInput {
  parts_exists: Boolean
  measures: [RhythmScoreMeasureQueryInput]
  measures_in: [RhythmScoreMeasureQueryInput]
  measures_nin: [RhythmScoreMeasureQueryInput]
  measures_exists: Boolean
  OR: [RhythmScoreQueryInput!]
  AND: [RhythmScoreQueryInput!]
  parts: RhythmScorePartQueryInput
}

type InsertManyPayload {
  insertedIds: [ObjectId]!
}

input RhythmScoreMeasurePartVoiceTupletUpdateInput {
  normal_inc: Int
  start_unset: Boolean
  end_inc: Int
  end: Int
  actual_unset: Boolean
  normal: Int
  normal_unset: Boolean
  start_inc: Int
  end_unset: Boolean
  actual: Int
  start: Int
  actual_inc: Int
}

input RhythmScoreMeasurePartQueryInput {
  OR: [RhythmScoreMeasurePartQueryInput!]
  voices_in: [RhythmScoreMeasurePartVoiceQueryInput]
  voices_nin: [RhythmScoreMeasurePartVoiceQueryInput]
  instrument_lt: String
  instrument_nin: [String]
  voices: [RhythmScoreMeasurePartVoiceQueryInput]
  instrument_lte: String
  instrument_gt: String
  instrument_gte: String
  AND: [RhythmScoreMeasurePartQueryInput!]
  instrument_exists: Boolean
  instrument_ne: String
  instrument: String
  instrument_in: [String]
  voices_exists: Boolean
}

input RhythmScoreMeasurePartVoiceTupletInsertInput {
  normal: Int
  start: Int
  end: Int
  actual: Int
}

type RhythmMutation {
  config: String
  context: String
  grid: Int
  type: String
}

input RhythmScorePartQueryInput {
  tenors: RhythmScorePartTenorQueryInput
  AND: [RhythmScorePartQueryInput!]
  snare: RhythmScorePartSnareQueryInput
  tenors_exists: Boolean
  bass_exists: Boolean
  cymbals_exists: Boolean
  OR: [RhythmScorePartQueryInput!]
  drumset_exists: Boolean
  drumset: RhythmScorePartDrumsetQueryInput
  cymbals: RhythmScorePartCymbalQueryInput
  bass: RhythmScorePartBassQueryInput
  snare_exists: Boolean
}

input RhythmScorePartTenorQueryInput {
  enabled_exists: Boolean
  AND: [RhythmScorePartTenorQueryInput!]
  OR: [RhythmScorePartTenorQueryInput!]
  enabled: Boolean
  enabled_ne: Boolean
}

input RhythmScorePartBassUpdateInput {
  enabled: Boolean
  enabled_unset: Boolean
}

type RhythmScoreMeasure {
  parts: [RhythmScoreMeasurePart]
  timeSig: RhythmScoreMeasureTimeSig
}

input RhythmScoreMeasureInsertInput {
  parts: [RhythmScoreMeasurePartInsertInput]
  timeSig: RhythmScoreMeasureTimeSigInsertInput
}

input LinkUpdateInput {
  value_unset: Boolean
  _id: String
  _id_unset: Boolean
  type: String
  type_unset: Boolean
  value: String
}

input RhythmInsertInput {
  mutations: [RhythmMutationInsertInput]
  _userId: String!
  _id: String
  type: String
  name: String!
  date: DateTime!
  tempo: Float
  score: RhythmScoreInsertInput!
}

type UpdateManyPayload {
  matchedCount: Int!
  modifiedCount: Int!
}

input LinkInsertInput {
  value: String!
  _id: String
  type: String!
}

input RhythmMutationInsertInput {
  grid: Int
  context: String
  config: String
  type: String
}

input RhythmScoreMeasurePartVoiceUpdateInput {
  tuplets: [RhythmScoreMeasurePartVoiceTupletUpdateInput]
  tuplets_unset: Boolean
  notes: [RhythmScoreMeasurePartVoiceNoteUpdateInput]
  notes_unset: Boolean
}

type RhythmScorePart {
  bass: RhythmScorePartBass
  cymbals: RhythmScorePartCymbal
  drumset: RhythmScorePartDrumset
  snare: RhythmScorePartSnare
  tenors: RhythmScorePartTenor
}

type RhythmScorePartTenor {
  enabled: Boolean
}

type RhythmScorePartCymbal {
  enabled: Boolean
}

type RhythmScorePartDrumset {
  enabled: Boolean
}

input RhythmScorePartBassQueryInput {
  enabled_exists: Boolean
  AND: [RhythmScorePartBassQueryInput!]
  OR: [RhythmScorePartBassQueryInput!]
  enabled: Boolean
  enabled_ne: Boolean
}

type DeleteManyPayload {
  deletedCount: Int!
}

type RhythmScorePartSnare {
  enabled: Boolean
}

input RhythmScoreMeasureTimeSigQueryInput {
  type_lt: Int
  OR: [RhythmScoreMeasureTimeSigQueryInput!]
  type: Int
  type_in: [Int]
  type_exists: Boolean
  num_lt: Int
  type_gt: Int
  type_ne: Int
  num_exists: Boolean
  type_lte: Int
  num_in: [Int]
  num_gt: Int
  num_nin: [Int]
  AND: [RhythmScoreMeasureTimeSigQueryInput!]
  num_ne: Int
  type_nin: [Int]
  type_gte: Int
  num: Int
  num_gte: Int
  num_lte: Int
}

input RhythmScoreInsertInput {
  measures: [RhythmScoreMeasureInsertInput]
  parts: RhythmScorePartInsertInput
}

input RhythmScorePartTenorInsertInput {
  enabled: Boolean
}

input RhythmScoreMeasureUpdateInput {
  timeSig: RhythmScoreMeasureTimeSigUpdateInput
  timeSig_unset: Boolean
  parts: [RhythmScoreMeasurePartUpdateInput]
  parts_unset: Boolean
}

type RhythmScoreMeasurePartVoiceTuplet {
  actual: Int
  end: Int
  normal: Int
  start: Int
}

input RhythmScoreMeasureTimeSigUpdateInput {
  type: Int
  type_inc: Int
  type_unset: Boolean
  num: Int
  num_inc: Int
  num_unset: Boolean
}

input RhythmScoreMeasurePartUpdateInput {
  instrument: String
  instrument_unset: Boolean
  voices: [RhythmScoreMeasurePartVoiceUpdateInput]
  voices_unset: Boolean
}
`;

const resolvers = {
    Query: {
      getLinkRhythmById: async (parent, { input }, { dataSources }) => {
          const result = await dataSources.rhythms.findOneById(input);
          return result;
      },
      getRhythmById: async (parent, { input }, { dataSources }) => {
        const result = await dataSources.rhythms.findOneById(input);
        return result;
      },
      link: async (parent, { query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.findOneLink(query);
          return result;
        } catch (error) {
          console.error("Query: link - Error:", error);
          throw error;
        }
      },
      links: async (parent, { sortBy, query, limit }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.findLinks({ sortBy, query, limit });
          return result;
        } catch (error) {
          console.error("Query: links - Error:", error);
          throw error;
        }
      },
      rhythm: async (parent, { query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.findOne(query);
          return result;
        } catch (error) {
          console.error("Query: rhythm - Error:", error);
          throw error;
        }
      },
      // rhythms: async (parent, { query, limit, sortBy }, { dataSources }) => {
      //   console.log("Query: rhythms - query:", query, "limit:", limit, "sortBy:", sortBy);
      //   try {
      //     const result = await dataSources.rhythms.findMany({ query, limit, sortBy });
      //     console.log("Query: rhythms - Result:", result);
      //     return result;
      //   } catch (error) {
      //     console.error("Query: rhythms - Error:", error);
      //     throw error;
      //   }
      // }
      rhythms: async (_, { query }, { dataSources }) => {
        return dataSources.rhythms.getAll(query);
      },
    },
    Mutation: {
      deleteManyLinks: async (parent, { query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.deleteManyLinks(query);
          return result;
        } catch (error) {
          console.error("Mutation: deleteManyLinks - Error:", error);
          throw error;
        }
      },
      deleteManyRhythms: async (parent, { query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.deleteMany(query);
          return result;
        } catch (error) {
          console.error("Mutation: deleteManyRhythms - Error:", error);
          throw error;
        }
      },
      deleteOneLink: async (parent, { query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.deleteOneLink(query);
          return result;
        } catch (error) {
          console.error("Mutation: deleteOneLink - Error:", error);
          throw error;
        }
      },
      deleteOneRhythm: async (parent, { query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.deleteOne(query);
          return result;
        } catch (error) {
          console.error("Mutation: deleteOneRhythm - Error:", error);
          throw error;
        }
      },
      getRhythmLink: async (parent, { input }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.generateRhythmLink(input);
          return result;
        } catch (error) {
          console.error("Mutation: getRhythmLink - Error:", error);
          throw error;
        }
      },
      insertManyLinks: async (parent, { data }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.insertManyLinks(data);
          return result;
        } catch (error) {
          console.error("Mutation: insertManyLinks - Error:", error);
          throw error;
        }
      },
      insertManyRhythms: async (parent, { data }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.insertMany(data);
          return result;
        } catch (error) {
          console.error("Mutation: insertManyRhythms - Error:", error);
          throw error;
        }
      },
      insertOneLink: async (parent, { data }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.insertOneLink(data);
          return result;
        } catch (error) {
          console.error("Mutation: insertOneLink - Error:", error);
          throw error;
        }
      },
      insertOneRhythm: async (parent, { data }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.insertOne(data);
          return result;
        } catch (error) {
          console.error("Mutation: insertOneRhythm - Error:", error);
          throw error;
        }
      },
      replaceOneLink: async (parent, { query, data }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.replaceOneLink(query, data);
          return result;
        } catch (error) {
          console.error("Mutation: replaceOneLink - Error:", error);
          throw error;
        }
      },
      replaceOneRhythm: async (parent, { query, data }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.replaceOne(query, data);
          return result;
        } catch (error) {
          console.error("Mutation: replaceOneRhythm - Error:", error);
          throw error;
        }
      },
      updateManyLinks: async (parent, { query, set }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.updateManyLinks(query, set);
          return result;
        } catch (error) {
          console.error("Mutation: updateManyLinks - Error:", error);
          throw error;
        }
      },
      updateManyRhythms: async (parent, { query, set }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.updateMany(query, set);
          return result;
        } catch (error) {
          console.error("Mutation: updateManyRhythms - Error:", error);
          throw error;
        }
      },
      updateOneLink: async (parent, { query, set }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.updateOneLink(query, set);
          return result;
        } catch (error) {
          console.error("Mutation: updateOneLink - Error:", error);
          throw error;
        }
      },
      updateOneRhythm: async (parent, { query, set }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.updateOne(query, set);
          return result;
        } catch (error) {
          console.error("Mutation: updateOneRhythm - Error:", error);
          throw error;
        }
      },
      upsertOneLink: async (parent, { data, query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.upsertOneLink(query, data);
          return result;
        } catch (error) {
          console.error("Mutation: upsertOneLink - Error:", error);
          throw error;
        }
      },
      upsertOneRhythm: async (parent, { data, query }, { dataSources }) => {
        try {
          const result = await dataSources.rhythms.upsertOne(query, data);
          return result;
        } catch (error) {
          console.error("Mutation: upsertOneRhythm - Error:", error);
          throw error;
        }
      },
    },
    Rhythm: {
      _id: (parent) => {
        return parent._id.toString();
      },
      date: (parent) => {
        return new Date(parent.date);
      },
      mutations: (parent) => {
        return parent.mutations || [];
      },
      score: (parent) => {
        return parent.score;
      },
      tempo: (parent) => {
        return parent.tempo;
      },
      type: (parent) => {
        return parent.type;
      },
      name: (parent) => {
        return parent.name;
      },
      _userId: (parent) => {
        return parent._userId;
      },
    },
    Link: {
      _id: (parent) => {
        return parent._id.toString();
      },
      type: (parent) => {
        return parent.type;
      },
      value: (parent) => {
        return parent.value;
      },
    },
    RhythmScore: {
      measures: (parent) => {
        return parent.measures || [];
      },
      parts: (parent) => {
        return parent.parts;
      },
    },
    RhythmScorePart: {
      bass: (parent) => {
        return parent.bass;
      },
      cymbals: (parent) => {
        return parent.cymbals;
      },
      drumset: (parent) => {
        return parent.drumset;
      },
      snare: (parent) => {
        return parent.snare;
      },
      tenors: (parent) => {
        return parent.tenors;
      },
    },
    RhythmScoreMeasure: {
      parts: (parent) => {
        return parent.parts || [];
      },
      timeSig: (parent) => {
        return parent.timeSig;
      },
    },
    RhythmScoreMeasurePart: {
      instrument: (parent) => {
        return parent.instrument;
      },
      voices: (parent) => {
        return parent.voices || [];
      },
    },
    RhythmScoreMeasurePartVoice: {
      notes: (parent) => {
        return parent.notes || [];
      },
      tuplets: (parent) => {
        return parent.tuplets || [];
      },
    },
    RhythmScoreMeasurePartVoiceNote: {
      dots: (parent) => {
        return parent.dots;
      },
      duration: (parent) => {
        return parent.duration;
      },
      head: (parent) => {
        return parent.head;
      },
      notes: (parent) => {
        return parent.notes || [];
      },
      ornaments: (parent) => {
        return parent.ornaments;
      },
      velocity: (parent) => {
        return parent.velocity;
      },
    },
    RhythmScoreMeasurePartVoiceTuplet: {
      actual: (parent) => {
        return parent.actual;
      },
      end: (parent) => {
        return parent.end;
      },
      normal: (parent) => {
        return parent.normal;
      },
      start: (parent) => {
        return parent.start;
      },
    },
    RhythmScoreMeasureTimeSig: {
      num: (parent) => {
        return parent.num;
      },
      type: (parent) => {
        return parent.type;
      },
    },
    RhythmMutation: {
      config: (parent) => {
        return parent.config;
      },
      context: (parent) => {
        return parent.context;
      },
      grid: (parent) => {
        return parent.grid;
      },
      type: (parent) => {
        return parent.type;
      },
    },
    DateTime: new GraphQLScalarType({
      name: 'DateTime',
      description: 'Date and time scalar type',
      parseValue(value) {
        return new Date(value);
      },
      serialize(value) {
        return value.toISOString();
      },
      parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
          return new Date(ast.value);
        }
        return null;
      },
    }),
    ObjectId: new GraphQLScalarType({
      name: 'ObjectId',
      description: 'ObjectId scalar type',
      parseValue(value) {
        return new ObjectId(value);
      },
      serialize(value) {
        return value.toHexString();
      },
      parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
          return new ObjectId(ast.value);
        }
        return null;
      },
    }),
  };
const server = new ApolloServer({
    typeDefs,
    resolvers,
});

// Typescript: req has the type NextRequest
export default async function handler(req, res) {
  try {
    await startServerAndCreateNextHandler(server, {
      context: async (a, b) => { 
        try {
          await client.connect(); // Ensure client.connect() is awaited
          const db = client.db('drumtoolz');
          const token = req.headers.token;
          return {
              dataSources: {
                  rhythms: new Rhythms({ modelOrCollection: db.collection('rhythms') })
              },
              token,
          };
      } catch (error) {
          console.error('Error connecting to MongoDB:', error);
          throw error; // Re-throw the error to prevent GraphQL execution
      }
      },
    })(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}