import useSetVoices from "./setVoices-hook";
import useSnareVoices from "./snareVoices-hook";
import useTenorVoices from "./tenorVoices-hook";
//import useBassVoices from "../src/components/compose/hooks/bassVoices-hook";
//import useCrashVoices from "../src/components/compose/hooks/crashVoices-hook";
import { getSelectedInstrument } from '../../../store/score';
import { useSelector } from 'react-redux';

export default function useInstruments() {
  const setVoices = useSetVoices();
  const snareVoices = useSnareVoices();
  const tenorVoices = useTenorVoices();
  //const bassVoices = useBassVoices();
  //const crashVoices = useCrashVoices();

  const selectedInstrument = useSelector(state => {
    return getSelectedInstrument(state.score.present);
  });

  const instrumentData = {
    drumset: {
      voiceButtons: setVoices,
    },
    tenors: {
      voiceButtons: tenorVoices,
    },
    snare: {
      voiceButtons: snareVoices
    }
  };

  const data = instrumentData[selectedInstrument];

   return { voiceButtons: data.voiceButtons}
}
