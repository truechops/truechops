import React, {useState, useEffect} from 'react';
import * as Tone from 'tone';

//The object passed to createContext is the default context that gets used
//when the context is not set by the context provider. 
const ToneContext = React.createContext({
    setSampler: null,
    tenorsSampler: null
});

export const ToneContextProvider = props => {
    const [setSampler, setSetSampler] = useState();
    const [tenorsSampler, setTenorsSampler] = useState();

    useEffect(() => {
        const setSampler = new Tone.Sampler({
            urls: {
              C5: "snare.wav",
              E5: "hh.wav",
              D4: "kick.wav",
            },
            release: 1,
            baseUrl: `${window.location.href}samples/set/`,
          }).toDestination();
          setSetSampler(setSampler);
        
          const tenorsSampler = new Tone.Sampler({
            urls: {
              C5: "1.wav",
              E5: "2.wav",
              D4: "3.wav",
            },
            release: 1,
            baseUrl: `${window.location.href}samples/tenors/`,
          }).toDestination();
          setTenorsSampler(tenorsSampler);

          
        
          new Tone.PolySynth().toDestination();

          
      }, []);

    return <ToneContext.Provider value={{
        setSampler, 
        tenorsSampler
    }}>{props.children}</ToneContext.Provider>
};

export default ToneContext;
