import { useDispatch, useSelector } from 'react-redux';
import { scoreActions } from '../../../../store/score';
import Button from '../../../ui/Button';
import { ThemeProvider } from '@mui/material/styles';

export default function useSnareVoices() {
    const { snareSelected, pingSelected, rimSelected, 
            buttSelected, backstickSelected, crossoverSelected,
            stickClickSelected } = useSelector(state => state.score.present.voices.snare);

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
        {
          onClick: () => {
            dispatch(scoreActions.toggleButtSelected());
          },
          text: "Butt",
          selected: buttSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleBackstickSelected());
          },
          text: "Back",
          selected: backstickSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleCrossoverSelected());
          },
          text: "Cross",
          selected: crossoverSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleStickClickSelected());
          },
          text: "Click",
          selected: stickClickSelected,
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

      return [buttons.slice(0, 4), buttons.slice(4)];
}