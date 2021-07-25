import { useDispatch, useSelector } from 'react-redux';
import { scoreActions } from '../../../../store/score';
import Button from '../../../ui/Button';

export default function useSetVoices() {
    const { kickSelected,
    snareSelected,
    hiHatSelected,
    rideSelected,
    hiHatFootSelected,
    tom1Selected,
    tom2Selected,
    tom3Selected,
    tom4Selected } = useSelector(state => state.score.present.voices.drumset);

    const dispatch = useDispatch();
    const instrumentsRow1 = [
        {
          onClick: () => {
            dispatch(scoreActions.toggleKickSelected());
          },
          text: "K",
          selected: kickSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleSnareSelected());
          },
          text: "S",
          selected: snareSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleHiHatSelected());
          },
          text: "HH",
          selected: hiHatSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleRideSelected());
          },
          text: "R",
          selected: rideSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleHiHatFootSelected());
          },
          text: "HF",
          selected: hiHatFootSelected,
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
    
      const instrumentsRow2 = [
        {
          onClick: () => {
            dispatch(scoreActions.toggleTom1Selected());
          },
          text: "T1",
          selected: tom1Selected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleTom2Selected());
          },
          text: "T2",
          selected: tom2Selected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleTom3Selected());
          },
          text: "T3",
          selected: tom3Selected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleTom4Selected());
          },
          text: "T4",
          selected: tom4Selected,
        }
      ].map((props) => (
        <Button
          key={Math.random().toString()}
          onClick={props.onClick}
          selected={props.selected}
        >
          {props.text}
        </Button>
      ));

      return [instrumentsRow1, instrumentsRow2];
}