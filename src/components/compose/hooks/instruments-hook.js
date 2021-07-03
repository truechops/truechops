import useSetVoices from "./setVoices-hook";
import useSnareVoices from "./snareVoices-hook";
import useTenorVoices from "./tenorVoices-hook";
import useBassVoices from "./bassVoices-hook";
import useCymbalVoices from "./cymbalVoices-hook";
import { getSelectedInstrument } from '../../../store/score';
import { useSelector } from 'react-redux';

export default function useInstruments() {
  const setVoices = useSetVoices();
  const snareVoices = useSnareVoices();
  const tenorVoices = useTenorVoices();
  const bassVoices = useBassVoices();
  const crashVoices = useCymbalVoices();

  const selectedInstrument = useSelector(state => {
    return getSelectedInstrument(state.score.present);
  });

  const instrumentData = {
    drumset: {
      voiceButtons: setVoices,
    },
    snare: {
      voiceButtons: snareVoices
    },
    tenors: {
      voiceButtons: tenorVoices,
    },
    bass: {
      voiceButtons: bassVoices
    },
    cymbal: {
      voiceButtons: crashVoices
    }
  };

  const data = instrumentData[selectedInstrument];

   return { voiceButtons: data.voiceButtons}
}
