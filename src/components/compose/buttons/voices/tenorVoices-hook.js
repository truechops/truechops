import { useDispatch, useSelector } from 'react-redux';
import { scoreActions } from '../../../../store/score';

export default function useTenorVoices() {
    const { spockSelected, t1Selected, t2Selected, t3Selected, t4Selected } = useSelector(state => state.score.present.voices.tenors);

    const dispatch = useDispatch();
    const buttons = [
        {
          onClick: () => {
            dispatch(scoreActions.toggleSpockSelected());
          },
          text: "Spock",
          selected: spockSelected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleTenor1Selected());
          },
          text: "T1",
          selected: t1Selected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleTenor2Selected());
          },
          text: "T2",
          selected: t2Selected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleTenor3Selected());
          },
          text: "T3",
          selected: t3Selected,
        },
        {
          onClick: () => {
            dispatch(scoreActions.toggleTenor4Selected());
          },
          text: "T4",
          selected: t4Selected,
        },
      ];

      return buttons;
}