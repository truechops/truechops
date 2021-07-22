import gql from "graphql-tag";
import { RHYTHM_SCHEMA, LINK_SCHEMA } from './schemas';

export const GET_RHYTHM_BY_ID_QUERY = gql`
    query GetRhythmById($id: String!) {
        getRhythmById(input: $id) {
            ${RHYTHM_SCHEMA}
        }
    }
`;

export const GET_ALL_USER_SAVED_RHYTHMS_QUERY = gql`
    query GetAllSavedRhythmsForUser($userId: String!) {
        rhythms(query: { _userId: $userId, type: "saved" }) {
            ${RHYTHM_SCHEMA}
        }
    }
`;

export const ADD_RHYTHM_MUTATION = gql`
    mutation AddRhythm($rhythm: RhythmInsertInput!) {
        addedRhythm: insertOneRhythm(data: $rhythm) {
            ${RHYTHM_SCHEMA}
        }
    }
`

export const RHYTHM_FRAGMENT = gql`
    fragment RhythmFragment on Rhythm {
        ${RHYTHM_SCHEMA}
    }
`

export const ADD_LINK_MUTATION = gql`
    mutation AddLink($link: LinkInsertInput!) {
        addedLink: insertOneLink(data: $link) {
            ${LINK_SCHEMA}
        }
    }
`

export const LINK_FRAGMENT = gql`
    fragment LinkFragment on Link {
        ${LINK_SCHEMA}
    }
`;

export const GET_LINK_RHYTHM_BY_ID_QUERY = gql`
    query GetLinkRhythmById($id: String!) {
        getLinkRhythmById(input: $id) {
            ${RHYTHM_SCHEMA}
        }
    }
`;

export const GET_RHYTHM_LINK = gql`
    mutation GetRhythmLink($rhythm: RhythmInsertInput!) {
        addedLink: getRhythmLink(input: $rhythm)
    }
`;