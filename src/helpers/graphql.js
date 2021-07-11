export const rhythmSchema = `
    _id
	_userId
	name
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
                voices {
                    notes {
                        notes
                        velocity
                        duration
                    }
                }
            }
        }
    }
    
`;
