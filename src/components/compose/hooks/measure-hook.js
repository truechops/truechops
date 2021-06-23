import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../store/score';

export default function useMeasureFns() 
{
    const { measureIndex } = useSelector(state => state.score.selectedNote);
    const dispatch = useDispatch();
    
    return {
        addMeasure: addMeasure.bind(null, dispatch, measureIndex),
        deleteMeasure: deleteMeasure.bind(null, dispatch, measureIndex)
    }
}

function addMeasure(dispatch, index, isRight) {
    dispatch(scoreActions.addMeasure({ index, isRight}));
}

function deleteMeasure(dispatch, index) {
    dispatch(scoreActions.deleteMeasure(index));
}