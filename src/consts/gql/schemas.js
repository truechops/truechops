export const RHYTHM_SCHEMA = `
    _id
    __typename
	_userId
	name
    date
    tempo
    type
    score {
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
                        ornaments
                        velocity
                        duration
                        dots
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
    mutations {
        type
        context
        grid
        config
    }
`;

export const LINK_SCHEMA = `
    _id
    type
    value
`;