import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../store/score';
import { scoreAuxActions } from '../../../store/scoreAux';

export default function useMeasureFns() 
{
    const { measureIndex } = useSelector(state => state.scoreAux.selectedNote);
    const dispatch = useDispatch();
    
    return {
        addMeasure: addMeasure.bind(null, dispatch, measureIndex),
        deleteMeasure: deleteMeasure.bind(null, dispatch, measureIndex),
        setRepeatStart: setRepeatStart.bind(null, dispatch, measureIndex),
        setRepeatEnd: setRepeatEnd.bind(null, dispatch, measureIndex)
    }
}

function addMeasure(dispatch, index, isRight) {
    dispatch(scoreActions.addMeasure({ index, isRight}));
}

function deleteMeasure(dispatch, index) {
    dispatch(scoreActions.deleteMeasure(index));
}

function setRepeatStart(dispatch, index) {
    dispatch(scoreAuxActions.setRepeatStart(index));
}

function setRepeatEnd(dispatch, index) {
    dispatch(scoreAuxActions.setRepeatEnd(index));
}