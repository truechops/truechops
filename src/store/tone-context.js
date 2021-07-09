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
    const [cymbalSampler, setCymbalSampler] = useState();
    const [bassSampler, setBassSampler] = useState();
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
            baseUrl: `samples/drumset/`,
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
            baseUrl: `samples/tenors/`,
          }).toDestination();
          setTenorsSampler(tenorsSampler);

          const snareSampler = new Tone.Sampler({
            urls: {
              C5: 'snare.wav',
              E5: 'ping.wav',
              F5: 'rim.wav'
            },
            release: 1,
            baseUrl: `samples/snare/`,
          }).toDestination();
          setSnareSampler(snareSampler);

          const bassSampler = new Tone.Sampler({
            urls: {
              G5: 'b1.wav',
              E5: 'b2.wav',
              C5: 'b3.wav',
              A4: 'b4.wav',
              F4: 'b5.wav'
            },
            release: 1,
            baseUrl: `samples/bass/`,
          }).toDestination();
          setBassSampler(bassSampler);

          const cymbalSampler = new Tone.Sampler({
            urls: {
              E5: 'crash.wav',
              C5: 'choke.wav',
            },
            release: 1,
            baseUrl: `samples/cymbal/`,
          }).toDestination();
          setCymbalSampler(cymbalSampler);

          new Tone.PolySynth().toDestination();
      }, []);

    return <ToneContext.Provider value={{
        setSampler,
        snareSampler,
        tenorsSampler,
        bassSampler,
        cymbalSampler
    }}>{props.children}</ToneContext.Provider>
};

export default ToneContext;
