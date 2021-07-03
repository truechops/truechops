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
    const [snareSampler, setSnareSampler] = useState();

    //This setup is done in useEffect because it cannot be done server side when the page is being built.
    //This is because Tone.js uses calls that are only available in the browser.
    useEffect(() => {
        const setSampler = new Tone.Sampler({
            urls: {
              C5: "snare.wav",
              E5: "hh.wav",
              D4: 'hhf.wav',
              F5: 'ride.wav',
              F4: "kick.wav",
              D5: "tom1.wav",
              B4: "tom2.wav",
              A4: "tom3.wav",
              G4: "tom4.wav"
            },
            release: 1,
            baseUrl: `${window.location.href}samples/drumset/`,
          }).toDestination();
          setSetSampler(setSampler);
        
          const tenorsSampler = new Tone.Sampler({
            urls: {
              G5: 'S.wav',
              E5: "1.wav",
              C5: "2.wav",
              A4: "3.wav",
              F4: '4.wav'
            },
            release: 1,
            baseUrl: `${window.location.href}samples/tenors/`,
          }).toDestination();
          setTenorsSampler(tenorsSampler);

          const snareSampler = new Tone.Sampler({
            urls: {
              C5: 'snare.wav',
              E5: 'ping.wav',
              F5: 'rim.wav'
            },
            release: 1,
            baseUrl: `${window.location.href}samples/snare/`,
          }).toDestination();
          setSnareSampler(snareSampler);

          new Tone.PolySynth().toDestination();
      }, []);

    return <ToneContext.Provider value={{
        setSampler, 
        tenorsSampler,
        snareSampler
    }}>{props.children}</ToneContext.Provider>
};

export default ToneContext;
