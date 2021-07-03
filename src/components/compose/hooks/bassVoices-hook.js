import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../../store/score";
import Button from "../../ui/Button";

export default function useBassVoices() {
  const { b1Selected, b2Selected, b3Selected, b4Selected, b5Selected } =
    useSelector((state) => state.score.present.voices.bass);

  const dispatch = useDispatch();
  const buttons = [
    {
      onClick: () => {
        dispatch(scoreActions.toggleB1Selected());
      },
      text: "B1",
      selected: b1Selected,
    },
    {
      onClick: () => {
        dispatch(scoreActions.toggleB2Selected());
      },
      text: "B2",
      selected: b2Selected,
    },
    {
      onClick: () => {
        dispatch(scoreActions.toggleB3Selected());
      },
      text: "B3",
      selected: b3Selected,
    },
    {
      onClick: () => {
        dispatch(scoreActions.toggleB4Selected());
      },
      text: "B4",
      selected: b4Selected,
    },
    {
      onClick: () => {
        dispatch(scoreActions.toggleB5Selected());
      },
      text: "B5",
      selected: b5Selected,
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
