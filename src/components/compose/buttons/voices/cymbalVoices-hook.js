import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../../../store/score";

export default function useCymbalVoices() {
  const { crashSelected, chokeSelected } =
    useSelector((state) => state.score.present.voices.cymbals);

  const dispatch = useDispatch();
  const buttons = [
    {
      onClick: () => {
        dispatch(scoreActions.toggleCrashSelected());
      },
      text: "Crash",
      selected: crashSelected,
    },
    {
      onClick: () => {
        dispatch(scoreActions.toggleChokeSelected());
      },
      text: "Choke",
      selected: chokeSelected,
    },
  ];

  return buttons;
}
