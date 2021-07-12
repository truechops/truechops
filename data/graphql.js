import gql from "graphql-tag";

export const RHYTHM_SCHEMA = `
    _id
    __typename
	_userId
	name
    date
    score {
        tempo
        parts {
            drumset {
                enabled
            }
            snare {
                enabled
            }
            tenors {
                enabled
            }
            bass {
                enabled
            }
            cymbals {
                enabled
            }
        }
        measures {
            timeSig {
                num
                type
            }
            parts {
                instrument
                voices {
                    notes {
                        notes
                        velocity
                        duration
                    }
                    tuplets {
                        actual
                        normal
                        start
                        end
                    }
                }
            }
        }
    } 
`;

export const GET_RHYTHM_BY_ID_QUERY = gql`
    query GetRhythmById($id: String!) {
        getRhythmById(input: $id) {
            ${RHYTHM_SCHEMA}
        }
    }
`;

export const GET_ALL_USER_RHYTHMS_QUERY = gql`
    query GetAllRhythmsForUser($userId: String!) {
        rhythms(query: { _userId: $userId }) {
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
