import { useDispatch, useSelector } from 'react-redux';
import { scoreActions } from '../../../store/score';
import Button from '../../ui/Button';

export default function useSnareVoices() {
    const { snareSelected, pingSelected, rimSelected } = useSelector(state => state.score.present.voices.snare);

    const dispatch = useDispatch();
    const buttons = [
        {
          onClick: () => {
            dispatch(scoreActions.toggleMarchingSnareSelected());
          },
          text: "Snare",
          selected: snareSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.togglePingSelected());
          },
          text: "Ping",
          selected: pingSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleRimSelected());
          },
          text: "Rim",
          selected: rimSelected,
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

      return [buttons.slice(0, 2), buttons.slice(2)];
}