import useSetVoices from "./voices/setVoices-hook";
import useSnareVoices from "./voices/snareVoices-hook";
import useTenorVoices from "./voices/tenorVoices-hook";
import useBassVoices from "./voices/bassVoices-hook";
import useCymbalVoices from "./voices/cymbalVoices-hook";
import { getSelectedInstrument } from "../../../store/score";
import { useSelector } from "react-redux";

// [button text, voice name] for the selected instrument's help legend.
const legends = {
  drumset: [["K", "Kick"], ["S", "Snare"], ["HH", "Hi-hat"], ["R", "Ride"], ["HF", "Hi-hat foot"],
    ["T1", "Tom 1 (high tom)"], ["T2", "Tom 2 (middle tom)"], ["T3", "Tom 3 (low tom)"], ["T4", "Tom 4 (floor tom)"]],
  snare: [["Snare", "Snare"], ["Ping", "Ping"], ["Rim", "Rim"], ["Butt", "Butt end"], ["Back", "Backstick"], ["Cross", "Crossover"], ["Click", "Stick click"]],
  tenors: [["Spock", "Spock"], ["T1", "Tenor 1"], ["T2", "Tenor 2"], ["T3", "Tenor 3"], ["T4", "Tenor 4"]],
  bass: [["B1", "Bass 1"], ["B2", "Bass 2"], ["B3", "Bass 3"], ["B4", "Bass 4"], ["B5", "Bass 5"]],
  cymbals: [["Choke", "Choke"], ["Crash", "Crash"]],
};

export default function useInstruments() {
  const voices = {
    drumset: useSetVoices(),
    snare: useSnareVoices(),
    tenors: useTenorVoices(),
    bass: useBassVoices(),
    cymbals: useCymbalVoices(),
  };

  const selectedInstrument = useSelector((state) => {
    return getSelectedInstrument(state.score.present);
  });

  return { instrument: selectedInstrument, voiceButtons: voices[selectedInstrument], legend: legends[selectedInstrument] };
}
