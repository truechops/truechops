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
    const [cymbalsSampler, setCymbalsSampler] = useState();
    const [bassSampler, setBassSampler] = useState();
    const [tenorsSampler, setTenorsSampler] = useState();
    const [snareSampler, setSnareSampler] = useState();

    //This setup is done in useEffect because it cannot be done server side when the page is being built.
    //This is because Tone.js uses calls that are only available in the browser.
    useEffect(() => {
      const origin = window.location.origin;
        const setSampler = new Tone.Sampler({
            urls: {
              C5: "snare.mp3",
              E5: "hh.mp3",
              D4: 'hhf.mp3',
              F5: 'ride.mp3',
              F4: "kick.mp3",
              D5: "tom1.mp3",
              B4: "tom2.mp3",
              A4: "tom3.mp3",
              G4: "tom4.mp3"
            },
            release: 1,
            baseUrl: `${origin}/samples/drumset/`,
          }).toDestination();
          setSetSampler(setSampler);
        
          const tenorsSampler = new Tone.Sampler({
            urls: {
              G5: 'S.mp3',
              E5: "1.mp3",
              C5: "2.mp3",
              A4: "3.mp3",
              F4: '4.mp3'
            },
            release: 1,
            baseUrl: `${origin}/samples/tenors/`,
          }).toDestination();
          setTenorsSampler(tenorsSampler);

          const snareSampler = new Tone.Sampler({
            urls: {
              C5: 'snare.mp3',
              E5: 'ping.mp3',
              F5: 'rim.mp3'
            },
            release: 1,
            baseUrl: `${origin}/samples/snare/`,
          }).toDestination();
          setSnareSampler(snareSampler);

          const bassSampler = new Tone.Sampler({
            urls: {
              G5: 'b1.mp3',
              E5: 'b2.mp3',
              C5: 'b3.mp3',
              A4: 'b4.mp3',
              F4: 'b5.mp3'
            },
            release: 1,
            baseUrl: `${origin}/samples/bass/`,
          }).toDestination();
          setBassSampler(bassSampler);

          const cymbalsSampler = new Tone.Sampler({
            urls: {
              E5: 'crash.mp3',
              C5: 'choke.mp3',
            },
            release: 1,
            baseUrl: `${origin}/samples/cymbals/`,
          }).toDestination();
          setCymbalsSampler(cymbalsSampler);

          new Tone.PolySynth().toDestination();
      }, []);

    return <ToneContext.Provider value={{
        setSampler,
        snareSampler,
        tenorsSampler,
        bassSampler,
        cymbalsSampler
    }}>{props.children}</ToneContext.Provider>
};

export default ToneContext;
