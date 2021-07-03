import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../../store/score";
import Button from "../../ui/Button";

export default function useCymbalVoices() {
  const { crashSelected, chokeSelected } =
    useSelector((state) => state.score.present.voices.cymbal);

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
  ].map((props) => (
    <Button
      key={Math.random().toString()}
      onClick={props.onClick}
      selected={props.selected}
    >
      {props.text}
    </Button>
  ));

  return [buttons];
}
