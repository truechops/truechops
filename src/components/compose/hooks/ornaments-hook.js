import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../store/score';

export default function useMeasureFns() 
{
    const { partIndex, measureIndex, noteIndex } = useSelector(state => state.score.selectedNote);
    const dispatch = useDispatch();
    
    return {
        addMeasure: addMeasure.bind(null, dispatch, partIndex, measureIndex, noteIndex),
        deleteMeasure: deleteMeasure.bind(null, dispatch, partIndex, measureIndex, noteIndex),
        setRepeatStart: setRepeatStart.bind(null, dispatch, partIndex, measureIndex, noteIndex),
        setRepeatEnd: setRepeatEnd.bind(null, dispatch, partIndex, measureIndex, noteIndex),
        toggleRepeatEnabled: toggleRepeatEnabled.bind(null, dispatch, partIndex, measureIndex, noteIndex)
    }
}

function addMeasure(dispatch, partIndex, measureIndex, noteIndex) {
    dispatch(scoreActions.addMeasure({ index, isRight}));
}

function deleteMeasure(dispatch, partIndex, measureIndex, noteIndex) {
    dispatch(scoreActions.deleteMeasure(index));
}

function setRepeatStart(dispatch, partIndex, measureIndex, noteIndex) {
    dispatch(scoreActions.setRepeatStart(index));
}

function setRepeatEnd(dispatch, partIndex, measureIndex, noteIndex) {
    dispatch(scoreActions.setRepeatEnd(index));
}

function toggleRepeatEnabled(dispatch, partIndex, measureIndex, noteIndex) {
    dispatch(scoreActions.toggleRepeatEnabled());
}