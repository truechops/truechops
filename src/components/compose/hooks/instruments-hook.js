import useSetVoices from "./setVoices-hook";
import useSnareVoices from "./snareVoices-hook";
import useTenorVoices from "./tenorVoices-hook";
import useBassVoices from "./bassVoices-hook";
import useCymbalVoices from "./cymbalVoices-hook";
import { getSelectedInstrument } from "../../../store/score";
import { useSelector } from "react-redux";

export default function useInstruments() {
  const setVoices = useSetVoices();
  const snareVoices = useSnareVoices();
  const tenorVoices = useTenorVoices();
  const bassVoices = useBassVoices();
  const crashVoices = useCymbalVoices();

  const selectedInstrument = useSelector((state) => {
    return getSelectedInstrument(state.score.present);
  });

  const drumsetTooltipText = (
    <>
      K = Kick
      <br />
      S = Snare
      <br />
      HH = HiHat
      <br />
      R = Ride
      <br />
      HF = Hi Hat Foot
      <br />
      T1 = Tom 1 (High Tom)
      <br />
      T2 = Tom 2 (Middle Tom)
      <br />
      T3 = Tom 3 (Low Tom)
      <br />
      T4 = Tom 4 (Floor Tom){" "}
    </>
  );

  const snareTooltipText = 
  <>
  Snare = Snare
      <br />
      Ping = Ping
      <br />
      Rim = Rim
  </>;

  const tenorsTooltipText = (
    <>
      Spock = Spock
      <br />
      T1 = Tenor 1
      <br />
      T2 = Tenor 2
      <br />
      T3 = Tenor 3
      <br />
      T4 = Tenor 4
    </>
  );

  const bassTooltipText = (
    <>
      B1 = Bass 1
      <br />
      B2 = Bass 2
      <br />
      B3 = Bass 3
      <br />
      B4 = Bass 4
      <br />
      B5 = Bass 5
    </>
  );

  const cymbalTooltipText = (
    <>
      Choke = Choke
      <br />
      Crash = Crash
      <br />
    </>
  );

  const instrumentData = {
    drumset: {
      voiceButtons: setVoices,
      tooltipText: drumsetTooltipText
    },
    snare: {
      voiceButtons: snareVoices,
      tooltipText: snareTooltipText
    },
    tenors: {
      voiceButtons: tenorVoices,
      tooltipText: tenorsTooltipText
    },
    bass: {
      voiceButtons: bassVoices,
      tooltipText: bassTooltipText
    },
    cymbals: {
      voiceButtons: crashVoices,
      tooltipText: cymbalTooltipText
    },
  };

  const data = instrumentData[selectedInstrument];

  return { voiceButtons: data.voiceButtons, tooltipText: data.tooltipText };
}
